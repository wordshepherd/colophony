import type { Metadata } from "next";
import { InstanceIdentity } from "@/components/identity/instance-identity";

export const metadata: Metadata = {
  title: "Instance Identity - Colophony",
  description:
    "Federation status, trust relationships, and governance commitments",
};

export default function IdentityPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return <InstanceIdentity apiUrl={apiUrl} />;
}
