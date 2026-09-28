import React from 'react';
import { createRoot } from 'react-dom/client';
import graph from './service-map-data.json';
import './styles.css';

function strongestEvidence(service) {
  const evidence = service.evidence?.[0];
  return evidence ? `${evidence.type}: ${evidence.value}` : 'No evidence captured';
}

function App() {
  const services = graph.services ?? [];
  const highConfidence = services.filter((service) => service.confidence === 'high').length;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Internal Service Map</h1>
          <p>{graph.project?.name ?? 'This project'} uses these detected services.</p>
        </div>
        <span className="stamp">{new Date(graph.generatedAt).toLocaleString()}</span>
      </header>

      <section className="metrics" aria-label="Service map summary">
        <div><strong>{services.length}</strong><span>services</span></div>
        <div><strong>{highConfidence}</strong><span>high confidence</span></div>
        <div><strong>{graph.project?.framework ?? 'unknown'}</strong><span>source</span></div>
      </section>

      <section className="grid">
        {services.length ? services.map((service) => (
          <article className="card" key={service.id}>
            <div className="cardTop">
              <div className="logo" aria-hidden="true">
                {service.iconUrl ? <img src={service.iconUrl} alt="" /> : service.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="nameBlock">
                <strong>{service.name}</strong>
                <span>{service.confidence} confidence</span>
              </div>
            </div>
            <span className="category">{service.category}</span>
            <p>{strongestEvidence(service)}</p>
          </article>
        )) : <div className="empty">No external services were detected yet.</div>}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
