import { DotWaveField } from '../components/DotWaveField';
import './login-showcase.css';

const images = [
  { name: 'friends', src: '/assets/collegebook/friends-clean.webp', alt: 'College friends studying together' },
  { name: 'graduate', src: '/assets/collegebook/graduate-clean.webp', alt: 'College graduate celebrating' },
  { name: 'campus', src: '/assets/collegebook/campus-clean.webp', alt: 'College campus' },
  { name: 'students', src: '/assets/collegebook/students-clean.webp', alt: 'Students walking together' },
];

function LoginBrand() {
  return (
    <div className="cb-login-brand">
      <span className="cb-login-brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="23" height="23">
          <path d="M5 6.5 12 3l7 3.5v10L12 21l-7-4.5v-10Z" strokeLinejoin="round" />
          <path d="M5 6.5 12 10l7-3.5M12 10v11" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <strong>College<span>Book</span></strong>
        <small><img src="/assets/collegebook/ogigrid-logo.png" alt="" /> BY OGIGRID</small>
      </span>
    </div>
  );
}

export function LoginShowcaseLayout({ children }) {
  return (
    <main className="cb-login-shell">
      <div className="cb-login-wave" aria-hidden="true">
        <DotWaveField color="rgba(24,151,174,0.65)" density="high" opacity={0.65} dotSize={1.15} waveStrength={1.35} coverage="full" />
      </div>

      <section className="cb-login-left" aria-label="CollegeBook sign in">
        <LoginBrand />
        <div className="cb-login-intro">
          <p className="cb-login-eyebrow">YOUR INSTITUTION. YOUR PEOPLE. YOUR STORY.</p>
          <h1>Connect.<br />Remember.<br /><span>Belong.</span></h1>
        </div>
        <div className="cb-login-form-card">
          <p className="cb-login-instruction">Sign in to your CollegeBook account.</p>
          {children}
        </div>
        <p className="cb-login-footer">© {new Date().getFullYear()} CollegeBook · An OgiGrid platform</p>
      </section>

      <section className="cb-login-right" aria-label="CollegeBook campus community gallery">
        <div className="cb-login-collage">
          {images.map(({ name, src, alt }) => (
            <div key={name} className={`cb-login-photo cb-login-photo-${name}`}>
              <img src={src} alt={alt} loading={name === 'graduate' ? 'eager' : 'lazy'} />
            </div>
          ))}
          <span className="cb-login-sticker cb-login-sticker-friends"><span aria-hidden="true">👥</span> Friends for life</span>
          <span className="cb-login-sticker cb-login-sticker-campus"><span aria-hidden="true">🏛️</span> Your institution</span>
          <span className="cb-login-sticker cb-login-sticker-community"><span aria-hidden="true">♥</span> Your community</span>
        </div>
      </section>
    </main>
  );
}
