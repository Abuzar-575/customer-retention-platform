import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <section className="hero">
      <div className="hero-brand">
        RETENTION
        <br />
        <span>ARCADE</span>
      </div>
      <p className="hero-tag">
        Score churn risk like a high-score board. Pick a customer, dump a CSV, or crown the
        winning model — SHAP + AI plays keep the roster locked in.
      </p>
      <div className="hero-ctas">
        <Link className="btn" to="/predict">
          Play Single
        </Link>
        <Link className="btn btn-coral" to="/batch">
          Batch Arena
        </Link>
        <Link className="btn btn-ghost" to="/models">
          Model Lab
        </Link>
      </div>

      <div className="mode-cards">
        <Link className="mode-card" to="/predict">
          <span className="code">MODE 01</span>
          <h3>Single Predict</h3>
          <p>Walk a customer through a 3-stage form, then watch the risk meter fill.</p>
        </Link>
        <Link className="mode-card" to="/batch">
          <span className="code">MODE 02</span>
          <h3>Batch Arena</h3>
          <p>Drop a CSV, rack up KPIs, scan the roster, open anyone for a deep dive.</p>
        </Link>
        <Link className="mode-card" to="/models">
          <span className="code">MODE 03</span>
          <h3>Model Lab</h3>
          <p>Four models. One crown. Compare accuracy, recall, and ROC-AUC like rivals.</p>
        </Link>
      </div>
    </section>
  )
}
