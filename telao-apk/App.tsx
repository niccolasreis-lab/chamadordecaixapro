import { useKeepAwake } from 'expo-keep-awake';
import TelaoPage from './src/pages/TelaoPage';

export default function App() {
  useKeepAwake();
  return <TelaoPage />;
}
