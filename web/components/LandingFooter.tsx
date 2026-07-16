"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="landing-footer-full">
      <div className="container landing-footer-grid">
        <div className="landing-footer-brand">
          <p className="landing-footer-tagline">
            Pilote tous tes comptes Instagram depuis un seul dashboard.
          </p>
        </div>
        <div>
          <h4>Produit</h4>
          <ul>
            <li><a href="#features">Fonctionnalités</a></li>
            <li><a href="#equipe-va">Équipe & VAs</a></li>
            <li><a href="#showcase">Interface</a></li>
            <li><a href="#how">Comment ça marche</a></li>
            <li><a href="#pricing">Tarifs</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4>Compte</h4>
          <ul>
            <li><Link href="/login">Connexion</Link></li>
            <li><a href="#pricing">S&apos;abonner</a></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4>Intégrations</h4>
          <ul>
            <li><a href="https://linkscale.to" target="_blank" rel="noreferrer">Linkscale</a></li>
            <li><a href="https://whop.com" target="_blank" rel="noreferrer">Whop</a></li>
          </ul>
        </div>
      </div>
      <div className="container landing-footer-bottom">
        <p className="hint">© {new Date().getFullYear()} GramPulse. Tous droits réservés.</p>
      </div>
    </footer>
  );
}
