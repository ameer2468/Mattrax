import type { RequestSchema } from "@mattrax/email";
import { AwsClient } from "aws4fetch";
import { Resource } from "sst";
import { env, withEnv } from "~/env";

const aws = withEnv(() => {
	if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
		return {
			client: new AwsClient({
				region: "us-east-1",
				accessKeyId: env.AWS_ACCESS_KEY_ID,
				secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
			}),
		};
	}

	if (Resource.MattraxWebIAMUserAccessKey) {
		return {
			client: new AwsClient({
				region: "us-east-1",
				accessKeyId: Resource.MattraxWebIAMUserAccessKey.id,
				secretAccessKey: Resource.MattraxWebIAMUserAccessKey.secret,
			}),
		};
	}

	return { client: undefined };
});

export async function sendEmail(args: RequestSchema) {
	if (env.FROM_ADDRESS === "console") {
		console.log("SEND EMAIL", args);
		return;
	}

	if (!aws.client) {
		const msg = "AWS client not setup but 'FROM_ADDRESS' provided!";
		console.error(msg);
		throw new Error(msg);
	}

	// We lazy load to keep React + React email outta the main bundle
	await (await import("@mattrax/email").then((mod) => mod._sender))(
		args,
		aws.client,
		env.FROM_ADDRESS,
	);
}
