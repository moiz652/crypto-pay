import { ActivityDetailClient } from "./screen";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ActivityDetailClient id={id} />;
}
