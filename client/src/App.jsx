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
            style: { background: '#18191a', color: '#f7f8f8', border: '1px solid #34343a' },
          }}
        />
        <PageTransition>
          <AppRoutes />
        </PageTransition>
      </AuthProvider>
    </MotionConfig>
  );
}
