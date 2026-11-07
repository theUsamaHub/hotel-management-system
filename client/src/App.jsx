import ThemeToggle from './components/ThemeToggle.jsx';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';
import { MotionConfig } from 'framer-motion';
import PageTransition from './components/PageTransition.jsx';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
            },
          }}
        />
        <ThemeToggle />
        <PageTransition>
          <AppRoutes />
        </PageTransition>
      </AuthProvider>
    </MotionConfig>
  );
}
