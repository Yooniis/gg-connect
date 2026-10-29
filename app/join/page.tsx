"use client";

export default function JoinScreen() {
  return (
    <main className="projector join-screen">
      <div className="projector-noise" />
      <header>
        <div className="projector-brand">
          <img src="/gg-logo.png" alt="Good Game" />
          <span>
            CONNECT <b>JOIN</b>
          </span>
        </div>
        <div className="projector-status">
          <i /> PARKADEN · HÄRNÖSAND
        </div>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>
          ⛶ HELSKÄRM
        </button>
      </header>
      <section className="join-main">
        <div className="join-copy">
          <p className="screen-label">GÅ MED I SPELET</p>
          <h1>
            Skanna
            <br />
            och spela
          </h1>
          <ol>
            <li>
              <b>01</b>
              <span>Öppna kameran</span>
            </li>
            <li>
              <b>02</b>
              <span>Skanna QR-koden</span>
            </li>
            <li>
              <b>03</b>
              <span>Skapa din profil</span>
            </li>
          </ol>
          <p className="join-url">gg-parkaden.web.app</p>
        </div>
        <div className="join-qr">
          <img src="/join-qr.svg" alt="QR-kod som öppnar gg-parkaden.web.app" />
        </div>
      </section>
      <footer>
        <span>GOOD GAME CONNECT</span>
        <b>HITTA SIGNALER · UPPGRADERA KÄRNAN</b>
        <span>PARKADEN</span>
      </footer>
    </main>
  );
}
