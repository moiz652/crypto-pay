import { PayLinkClient } from "@/components/PayLinkClient";

export default async function PayLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PayLinkClient code={code} />;
}

