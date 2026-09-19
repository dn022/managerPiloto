import AdminProtected from "@/app/_components/AdminProtected";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminProtected>{children}</AdminProtected>;
}
