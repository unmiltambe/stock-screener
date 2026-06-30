"""Infrastructure: DynamoDB + Lambda (container) + API Gateway HTTP API +
Cognito + S3/CloudFront (unified origin for the React SPA, Phase 3).

Realizes docs/deploy-aws.md. The discovery batch (Phase 4) is intentionally NOT
here. CloudFront serves the SPA and proxies /v1/* + /health to the API so the
browser sees a single origin (no CORS).

Interim auth: the app's Basic-Auth middleware gates everything (env-configured).
The password is passed at deploy time via context (`-c basic_auth_pass=...`) so it
is never committed. Phase 2 replaces Basic Auth with a Cognito JWT authorizer and
this env var goes away — so we deliberately don't over-invest in a secrets store
for a soon-to-be-removed password.
"""
import os
import platform as _platform

from aws_cdk import (
    CfnOutput,
    Duration,
    Fn,
    RemovalPolicy,
    Stack,
)
from aws_cdk import aws_apigatewayv2 as apigwv2
from aws_cdk import aws_apigatewayv2_integrations as integrations
from aws_cdk import aws_cloudfront as cloudfront
from aws_cdk import aws_cloudfront_origins as origins
from aws_cdk import aws_cognito as cognito
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_ecr_assets as ecr_assets
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_s3 as s3
from constructs import Construct

# Docker build context = services/ (so the Dockerfile can COPY app/... and
# deploy/aws/requirements.txt). This file is at:
#   services/deploy/aws/cdk/stacks/stock_screener_stack.py
# → services/ is four levels up.
_SERVICES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
)

# Match the Lambda architecture to the build host so the image builds natively
# (no slow emulation): arm64 (Apple Silicon / Graviton) or x86_64.
_HOST_ARM = _platform.machine().lower() in ("arm64", "aarch64")


class StockScreenerStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        basic_auth_user = self.node.try_get_context("basic_auth_user") or "admin"
        basic_auth_pass = self.node.try_get_context("basic_auth_pass") or ""

        # The deployed SPA origin (CloudFront). Passed as a literal on a later
        # deploy — `-c frontend_url=https://<dist>.cloudfront.net` — once the
        # distribution exists, so its Hosted-UI callback can be registered without
        # creating a client→CloudFront→API→Lambda→client dependency cycle. Guests
        # don't use Cognito, so the first deploy can omit it.
        frontend_url = self.node.try_get_context("frontend_url")
        callback_urls = ["http://localhost:5173/callback", "http://localhost:3000/callback"]
        logout_urls = ["http://localhost:5173", "http://localhost:3000"]
        if frontend_url:
            callback_urls.append(f"{frontend_url}/callback")
            logout_urls.append(frontend_url)

        # ── DynamoDB: single-table store (design.md §5) ───────────────────────
        table = dynamodb.Table(
            self,
            "Table",
            partition_key=dynamodb.Attribute(
                name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(
                name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,  # scale-to-zero (P7)
            time_to_live_attribute="ttl",                       # 15-min score cache
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True),
            removal_policy=RemovalPolicy.DESTROY,  # dev: tear down cleanly. prod → RETAIN.
        )

        # ── Cognito: user pool + app client + Hosted UI (ADR-0008) ────────────
        user_pool = cognito.UserPool(
            self,
            "UserPool",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            password_policy=cognito.PasswordPolicy(
                min_length=8, require_lowercase=True, require_digits=True,
                require_uppercase=False, require_symbols=False),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.DESTROY,  # dev: prod → RETAIN
        )
        user_pool_client = user_pool.add_client(
            "WebClient",
            # user_password enables CLI token retrieval for Phase 2 testing; the SPA
            # uses SRP / the Hosted UI OAuth flows.
            auth_flows=cognito.AuthFlow(user_srp=True, user_password=True),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(
                    authorization_code_grant=True, implicit_code_grant=True),
                scopes=[cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL,
                        cognito.OAuthScope.PROFILE],
                callback_urls=callback_urls,
                logout_urls=logout_urls,
            ),
            prevent_user_existence_errors=True,
        )
        domain = user_pool.add_domain(
            "Domain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=f"stock-screener-{self.account}"),
        )

        # ── Lambda: the FastAPI app as a container image (Mangum handler) ──────
        fn = lambda_.DockerImageFunction(
            self,
            "Api",
            code=lambda_.DockerImageCode.from_image_asset(
                _SERVICES_DIR,
                file="deploy/aws/Dockerfile",
                platform=(ecr_assets.Platform.LINUX_ARM64 if _HOST_ARM
                        else ecr_assets.Platform.LINUX_AMD64),
            ),
            architecture=(lambda_.Architecture.ARM_64 if _HOST_ARM
                        else lambda_.Architecture.X86_64),
            memory_size=1024,                 # pandas/numpy + headroom
            timeout=Duration.seconds(30),     # matches API Gateway's max integration timeout
            environment={
                "DATA_BACKEND": "yfinance",
                "STORE_BACKEND": "dynamo",
                "DDB_TABLE": table.table_name,
                "AUTH_MODE": "jwt",                       # app-level Cognito JWT (ADR-0008)
                "COGNITO_REGION": self.region,
                "COGNITO_POOL_ID": user_pool.user_pool_id,
                "COGNITO_CLIENT_ID": user_pool_client.user_pool_client_id,
                "BASIC_AUTH_USER": basic_auth_user,       # still gates the interim /ui
                "BASIC_AUTH_PASS": basic_auth_pass,
            },
        )

        # Least privilege: the Lambda can touch only this one table.
        table.grant_read_write_data(fn)

        # Account deletion (DELETE /v1/account) removes the user's Cognito identity.
        user_pool.grant(fn, "cognito-idp:AdminDeleteUser")

        # ── API Gateway HTTP API: proxy every path/method to the Lambda ───────
        http_api = apigwv2.HttpApi(
            self,
            "HttpApi",
            default_integration=integrations.HttpLambdaIntegration("Integration", fn),
        )

        # ── Frontend: S3 (private) + CloudFront unified origin (ADR — option B) ─
        # CloudFront serves the SPA at / and proxies /v1/* + /health to the API,
        # so the browser sees one origin: no CORS, one URL for Cognito + clients.
        site_bucket = s3.Bucket(
            self,
            "SiteBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,  # reached only via CloudFront OAC
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.DESTROY,  # dev: tear down cleanly. prod → RETAIN.
            auto_delete_objects=True,              # dev convenience (pairs with DESTROY)
        )

        # SPA deep-link routing: rewrite extension-less paths (e.g. /watchlists/_all)
        # to the SPA shell so client-side routes survive a refresh. Attached to the
        # S3 behavior ONLY, so API requests (their own behavior) are never rewritten
        # — avoids the classic "404 error page clobbers API errors" mistake.
        spa_rewrite = cloudfront.Function(
            self,
            "SpaRewrite",
            code=cloudfront.FunctionCode.from_inline(
                "function handler(event) {"
                "  var r = event.request;"
                "  if (r.uri.indexOf('.') === -1) { r.uri = '/index.html'; }"
                "  return r;"
                "}"
            ),
        )

        # API origin = the HTTP API's domain (strip scheme/path from the endpoint).
        api_domain = Fn.select(2, Fn.split("/", http_api.api_endpoint))
        api_behavior = cloudfront.BehaviorOptions(
            origin=origins.HttpOrigin(api_domain),
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,   # GET/POST/PUT/PATCH/DELETE/OPTIONS
            cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,  # per-user data — never cache (covers all /v1)
            # forward everything EXCEPT Host (API Gateway must see its own host header)
            origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        )

        distribution = cloudfront.Distribution(
            self,
            "SiteDistribution",
            default_root_object="index.html",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(site_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                function_associations=[
                    cloudfront.FunctionAssociation(
                        function=spa_rewrite,
                        event_type=cloudfront.FunctionEventType.VIEWER_REQUEST,
                    )
                ],
            ),
            additional_behaviors={
                "/v1/*": api_behavior,
                "/health": api_behavior,
            },
            comment="stock-screener SPA + API (unified origin)",
        )

        CfnOutput(self, "ApiUrl", value=http_api.api_endpoint,
                description="Base URL of the deployed API (direct; CloudFront also proxies it)")
        CfnOutput(self, "FrontendUrl", value=f"https://{distribution.distribution_domain_name}",
                description="Public app URL (SPA + API, same origin)")
        CfnOutput(self, "FrontendBucket", value=site_bucket.bucket_name,
                description="S3 bucket to sync the built SPA into")
        CfnOutput(self, "DistributionId", value=distribution.distribution_id,
                description="CloudFront distribution id (for cache invalidation)")
        CfnOutput(self, "TableName", value=table.table_name,
                description="DynamoDB table (pass as DDB_TABLE to the seed script)")
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id,
                description="Cognito user pool id")
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id,
                description="Cognito app client id (audience)")
        CfnOutput(self, "HostedUiBaseUrl", value=domain.base_url(),
                description="Cognito Hosted UI base URL (append /login?...)")
