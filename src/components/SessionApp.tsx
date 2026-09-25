import { App } from './App';
import { AppProvider } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
export function SessionApp() {
  const {user} = useAuth();
  return <AppProvider key={user?.id || 'signed-out'}><App /></AppProvider>;
}
