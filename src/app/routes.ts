import { createBrowserRouter, redirect } from 'react-router';
import Layout from './components/remote-config/Layout';
import ListingPage from './pages/ListingPage';
import CreatePage from './pages/CreatePage';
import ViewPage from './pages/ViewPage';
import EditPage from './pages/EditPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        loader: () => redirect('/remote_configuration'),
      },
      {
        path: 'remote_configuration',
        Component: ListingPage,
      },
      {
        path: 'create_remote_configuration',
        Component: CreatePage,
      },
      {
        path: 'view_remote_configuration/:config_id',
        Component: ViewPage,
      },
      {
        path: 'edit_remote_configuration/:config_id',
        Component: EditPage,
      },
    ],
  },
]);
