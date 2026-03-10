import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ConfigProvider } from './store/ConfigContext';

export default function App() {
  return (
    <ConfigProvider>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
