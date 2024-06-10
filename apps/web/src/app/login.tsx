import { Navigate, useParams } from "@solidjs/router";
import { parse } from "cookie-es";
import type { ParentProps } from "solid-js";

export default function Layout(props: ParentProps) {
	const params = useParams();

	// We do this redirect in the layout so the empty layout doesn't render while navigating
	if (params?.code === undefined) {
		const cookies = parse(document.cookie);
		if (cookies.isLoggedIn === "true") return <Navigate href="/" />;
	}

	return (
		<div class="flex-grow flex justify-center items-center">
			<div class="w-full flex flex-col items-center justify-center">
				<div class="sm:mx-auto sm:w-full sm:max-w-md flex items-center justify-center pb-2">
					<h2 class="mt-4 text-center text-4xl font-bold leading-9 tracking-tight text-gray-900">
						Mattrax
					</h2>
				</div>

				{props.children}
			</div>
		</div>
	);
}
