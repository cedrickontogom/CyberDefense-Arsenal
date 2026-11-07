import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Tooltip, Badge } from 'antd'
import {
  HomeOutlined, DashboardOutlined, WarningOutlined, FileTextOutlined,
  NetworkOutlined, SafetyOutlined, RobotOutlined, PlayCircleOutlined,
  DatabaseOutlined, SettingOutlined, UserOutlined, LogoutOutlined,
  LockOutlined, BellOutlined, SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined
} from '@ant-design/icons'
import { useAuth } from './store/authStore'
import { useTheme } from './store/themeStore'
import { useWebSocket } from './store/wsStore'
import { PageLoading } from './components/common/PageLoading'
import './styles/layout.scss'

const { Header, Sider, Content, Footer } = Layout
const { SubMenu } = Menu

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const NetworkTopology = lazy(() => import('./pages/NetworkTopology').then(m => ({ default: m.NetworkTopology })))
const Alerts = lazy(() => import('./pages/Alerts').then(m => ({ default: m.Alerts })))
const Cases = lazy(() => import('./pages/Cases').then(m => ({ default: m.Cases })))
const ThreatIntel = lazy(() => import('./pages/ThreatIntel').then(m => ({ default: m.ThreatIntel })))
const AIInvestigation = lazy(() => import('./pages/AIInvestigation').then(m => ({ default: m.AIInvestigation })))
const Playbooks = lazy(() => import('./pages/Playbooks').then(m => ({ default: m.Playbooks })))
const Detection = lazy(() => import('./pages/Detection').then(m => ({ default: m.Detection })))
const Connectors = lazy(() => import('./pages/Connectors').then(m => ({ default: m.Connectors })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const Login = lazy(() => import('./pages/auth/Login').then(m => ({ default: m.Login })))

const menuItems = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Tableau de bord',
    path: '/dashboard',
  },
  {
    key: 'network',
    icon: <NetworkOutlined />,
    label: 'Topologie Réseau',
    path: '/network',
  },
  {
    key: 'alerts',
    icon: <WarningOutlined />,
    label: 'Alertes',
    path: '/alerts',
    badge: () => null, // Will be dynamic
  },
  {
    key: 'cases',
    icon: <FileTextOutlined />,
    label: 'Cas & Enquêtes',
    path: '/cases',
  },
  {
    key: 'threatintel',
    icon: <SafetyOutlined />,
    label: 'Threat Intelligence',
    path: '/threatintel',
  },
  {
    key: 'ai',
    icon: <RobotOutlined />,
    label: 'Investigation IA',
    path: '/ai',
  },
  {
    key: 'playbooks',
    icon: <PlayCircleOutlined />,
    label: 'Playbooks',
    path: '/playbooks',
  },
  {
    key: 'detection',
    icon: <DatabaseOutlined />,
    label: 'Moteur de Détection',
    path: '/detection',
  },
  {
    key: 'connectors',
    icon: <DatabaseOutlined />,
    label: 'Connecteurs',
    path: '/connectors',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Paramètres',
    path: '/settings',
  },
]

const LayoutWrapper: React.FC = () => {
  const { user, logout, permissions } = useAuth()
  const { collapsed, setCollapsed, theme, toggleTheme } = useTheme()
  const { unreadCount } = useWebSocket()

  const filteredMenuItems = menuItems.filter(item => {
    // Filter based on permissions if needed
    return true
  })

  const handleMenuClick = (key: string) => {
    // Navigation handled by react-router
  }

  const userMenuItems = [
    {
      key: 'profile',
      label: 'Profil',
      icon: <UserOutlined />,
    },
    {
      key: 'security',
      label: 'Sécurité',
      icon: <LockOutlined />,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      label: 'Déconnexion',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="site-sider"
        theme="dark"
      >
        <div className="logo">
          <h1>CyberDefense Arsenal</h1>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[window.location.pathname.replace('/dashboard', '') || '/dashboard']}
          items={filteredMenuItems.map(item => ({
            key: item.path,
            icon: item.icon,
            label: item.label,
            badge: item.badge?.(),
          }))}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <Layout>
        <Header className="site-header">
          <Tooltip title={collapsed ? 'Déplier le menu' : 'Replier le menu'}>
            <span
              className="trigger"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
          </Tooltip>

          <div className="header-search">
            <SearchOutlined />
            <input
              type="text"
              placeholder="Rechercher alertes, cas, hôtes..."
              className="search-input"
            />
          </div>

          <div className="header-actions">
            <Tooltip title="Notifications">
              <Badge count={unreadCount} color="red">
                <BellOutlined className="header-icon" />
              </Badge>
            </Tooltip>

            <Tooltip title="Thème">
              <span className="header-icon" onClick={toggleTheme}>
                {theme === 'dark' ? <SafetyOutlined /> : <HomeOutlined />}
              </span>
            </Tooltip>

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
              onClick={({ key }) => {
                if (key === 'logout') logout()
                else if (key === 'profile') window.location.href = '/settings?tab=profile'
                else if (key === 'security') window.location.href = '/settings?tab=security'
              }}
            >
              <div className="user-avatar">
                <Avatar
                  size={36}
                  icon={<UserOutlined />}
                  src={user?.avatar}
                />
                <span className="user-name">{user?.email || 'Utilisateur'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="site-content">
          <Breadcrumb
            style={{ margin: '16px 0' }}
            routes={[
              { path: '/', breadcrumbName: 'Accueil' },
              ...(window.location.pathname !== '/' && window.location.pathname !== '/dashboard'
                ? [{
                    path: window.location.pathname,
                    breadcrumbName: menuItems.find(m => m.path === window.location.pathname)?.label || 'Page',
                  }]
                : [])
            ]}
          />
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/network" element={<NetworkTopology />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/alerts/:id" element={<Alerts />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/cases/:id" element={<Cases />} />
              <Route path="/threatintel" element={<ThreatIntel />} />
              <Route path="/ai" element={<AIInvestigation />} />
              <Route path="/ai/:caseId" element={<AIInvestigation />} />
              <Route path="/playbooks" element={<Playbooks />} />
              <Route path="/detection" element={<Detection />} />
              <Route path="/connectors" element={<Connectors />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Content>

        <Footer className="site-footer">
          CyberDefense Arsenal v1.0.0 - Plateforme unifiée de défense cybersécurité
        </Footer>
      </Layout>
    </Layout>
  )
}

const App: React.FC = () => {
  const { isAuthenticated, checkAuth } = useAuth()

  React.useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (!isAuthenticated) {
    return <Login />
  }

  return <LayoutWrapper />
}

export default App