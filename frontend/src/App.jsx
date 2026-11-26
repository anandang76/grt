import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from './components/Guards';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Login from './pages/Login';

// Everything except the landing + login pages is code-split so first load stays small.
const Signup = lazy(() => import('./pages/Signup'));
const Forgot = lazy(() => import('./pages/Forgot'));
const Terms = lazy(() => import('./pages/Terms'));
const Home = lazy(() => import('./pages/Home'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Broker = lazy(() => import('./pages/Broker'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const Users = lazy(() => import('./pages/admin/Users'));
const UserDetail = lazy(() => import('./pages/admin/UserDetail'));
const Roles = lazy(() => import('./pages/admin/Roles'));
const Activity = lazy(() => import('./pages/admin/Activity'));
const HistoryData = lazy(() => import('./pages/admin/HistoryData'));
const MasterList = lazy(() => import('./pages/admin/MasterList'));

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <div className="boot"><span className="logo">GR</span></div>;

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="terms" element={<Terms />} />
          <Route element={<RequireAuth />}>
            <Route path="broker" element={<Broker />} />
          </Route>
          <Route element={<RequireAuth roles={['admin', 'superadmin']} />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Overview />} />
              <Route path="users" element={<Users />} />
              <Route path="users/:id" element={<UserDetail />} />
              <Route path="history" element={<HistoryData />} />
              <Route path="master-list" element={<MasterList />} />
              <Route element={<RequireAuth roles={['superadmin']} />}>
                <Route path="roles" element={<Roles />} />
                <Route path="activity" element={<Activity />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<Layout bare />}>
          <Route element={<RequireAuth />}>
            <Route path="home" element={<Home />} />
          </Route>
        </Route>

        <Route element={<Layout full />}>
          <Route element={<RequireAuth />}>
            <Route path="watchlist" element={<Watchlist />} />
          </Route>
        </Route>

        <Route element={<Layout narrow />}>
          <Route element={<GuestOnly />}>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot" element={<Forgot />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
