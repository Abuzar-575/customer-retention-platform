import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-pip" aria-hidden />
          RETENTION ARCADE
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/predict" className={({ isActive }) => (isActive ? 'active' : '')}>
            Single
          </NavLink>
          <NavLink to="/batch" className={({ isActive }) => (isActive ? 'active' : '')}>
            Batch
          </NavLink>
          <NavLink to="/models" className={({ isActive }) => (isActive ? 'active' : '')}>
            Model Lab
          </NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
