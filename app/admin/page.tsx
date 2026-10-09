import { adminConfigured, isAdminRequest } from "@/lib/admin-session";
import AdminQuestEditor from "./quest-editor";
import AdminLoginForm from "./login-form";
import AdminLogoutButton from "./logout-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="admin-shell">
        <section className="admin-form-wrap" style={{ maxWidth: 520, margin: "4rem auto" }}>
          <p className="eyebrow">KONFIGURATION SAKNAS</p>
          <h1>ADMIN_PIN saknas</h1>
          <p>
            Sätt miljövariabeln <code>ADMIN_PIN</code> (minst 4 tecken) lokalt i{" "}
            <code>.env.local</code> eller i Firebase App Hosting, starta om appen
            och öppna den här sidan igen.
          </p>
        </section>
      </main>
    );
  }

  if (!(await isAdminRequest())) {
    return <AdminLoginForm />;
  }

  return (
    <main className="admin-shell">
      <header className="admin-top">
        <a href="/" className="admin-logo">
          GOOD GAME <b>QUEST ADMIN</b>
        </a>
        <div>
          <a href="/live" target="_blank">
            ▣ Öppna projektorvy
          </a>
          <span>Admin</span>
          <AdminLogoutButton />
        </div>
      </header>
      <AdminQuestEditor />
    </main>
  );
}
