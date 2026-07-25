import type { Metadata } from "next";
import { InstanceIdentity } from "@/components/identity/instance-identity";
import { clientEnv } from "@/env";

export const metadata: Metadata = {
  title: "Instance Identity",
  description:
    "Federation status, trust relationships, and governance commitments",
};

export default function IdentityPage() {
  const apiUrl = clientEnv.NEXT_PUBLIC_API_URL;
  return <InstanceIdentity apiUrl={apiUrl} />;
}
