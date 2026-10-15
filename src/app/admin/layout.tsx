/** Admin pages keep their existing content; this only gives them the page width the new layout no longer adds. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="container">{children}</div>;
}
