import { Navigate, useNavigate } from "react-router-dom";
import { clearToken, getCurrentUser } from "../lib/auth";
import "./HomePage.css";

export function HomePage() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  if (!user) return <Navigate to="/login" replace />;

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="home">
      <div className="home__brand">Transit</div>
      <div className="home__card">
        <div className="home__eyebrow">Signed in</div>
        <h1 className="home__role">{user.role}</h1>
        <p className="home__id">{user.sub}</p>
        <button className="home__logout" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
