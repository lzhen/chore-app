import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext';
import { isDesignSystemReference } from './reference/previewReference';
// Preserve the approved product cascade while its JavaScript entry is lazy.
import './components/Logo.css';
import './components/ChoicePicker.css';
import './components/TeamMemberList.css';
import './components/Calendar.css';
import './components/DeleteChoreDialog.css';
import './components/ChoreModal.css';
import './components/ChoreTaskRow.css';
import './components/AuthForm.css';
import './components/ChatPanel.css';
import './components/SectionHeading.css';
import './components/AvailabilityModal.css';
import './index.css';
import './nesmi-refinement.css';
import './styles/nesmi-tokens.css';
import './styles/nesmi-product-adoption.css';

const reference = isDesignSystemReference(
  (window as Window & { __NESMI_PREVIEW__?: boolean }).__NESMI_PREVIEW__,
  window.location.search,
);
// Neither auth nor app data is initialized when opening the private reference.
const Entry = reference
  ? lazy(() => import('./reference/DesignSystemReference'))
  : lazy(async () => {
      const [{ SessionApp }, { AuthProvider }] = await Promise.all([
        import('./components/SessionApp'), import('./context/AuthContext'),
      ]);
      return { default: () => <AuthProvider><SessionApp /></AuthProvider> };
    });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider persistPreference={!reference}>
      <Suspense fallback={<p role="status" style={{ padding: 24 }}>Loading Nesmi…</p>}>
        <Entry />
      </Suspense>
    </ThemeProvider>
  </React.StrictMode>
);

if (!reference && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
