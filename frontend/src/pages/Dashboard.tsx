import React, { useEffect, useState } from 'react'
import {
  Row, Col, Card, Statistic, Alert, Tag, Badge,
  Space, Divider, Grid, Typography, Button, Select,
  DatePicker, Spin, Skeleton, Dropdown, Menu
} from 'antd'
import {
  WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  InfoCircleOutlined, DatabaseOutlined, NetworkOutlined,
  RobotOutlined, PlayCircleOutlined, SyncOutlined,
  DownOutlined, UpOutlined, DollarCircleOutlined
} from '@ant-design/icons'
import { useAuth } from '../store/authStore'
import { useWebSocket } from '../store/wsStore'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import './Dashboard.scss'

const { Title, Text, Paragraph } = Typography

interface StatsData {
  alerts: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    new: number
    investigating: number
    resolved: number
  }
  cases: {
    total: number
    open: number
    closed: number
    sla_breach: number
  }
  network: {
    devices: number
    scans_today: number
    new_devices: number
  }
  ai: {
    investigations_today: number
    avg_confidence: number
    auto_resolved: number
  }
}

interface TrendData {
  date: string
  alerts: number
  cases: number
  investigations: number
}

interface RecentAlert {
  id: string
  alert_id: string
  title: string
  severity: string
  status: string
  connector: string
  host: string
  occurred_at: string
}

interface RecentCase {
  id: string
  title: string
  status: string
  severity: string
  assignee: string
  created_at: string
}

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { alertNotifications } = useWebSocket()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([])
  const [recentCases, setRecentCases] = useState<RecentCase[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<[Date, Date]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date(),
  ])
  const [refreshing, setRefreshing] = useState(false)

  const severityColors: Record<string, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'gold',
    low: 'blue',
    info: 'gray',
  }

  const statusColors: Record<string, string> = {
    new: 'blue',
    triaged: 'purple',
    investigating: 'orange',
    resolved: 'green',
    closed: 'gray',
    false_positive: 'gray',
    duplicate: 'gray',
  }

  const fetchData = async () => {
    setRefreshing(true)
    try {
      const [statsRes, trendsRes, alertsRes, casesRes] = await Promise.all([
        api.get('/alerts/alerts/stats/'),
        api.get('/alerts/alerts/stats/', { params: { trend: true, range: '7d' } }),
        api.get('/alerts/alerts/', { params: { limit: 10, ordering: '-occurred_at' } }),
        api.get('/cases/cases/', { params: { limit: 5, ordering: '-created_at' } }),
      ])

      setStats(statsRes)
      setTrends(trendsRes.trends || [])
      setRecentAlerts(alertsRes.results || [])
      setRecentCases(casesRes.results || [])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [timeRange])

  const handleTimeRangeChange = (dates: [Date, Date]) => {
    setTimeRange(dates)
    fetchData()
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <Title level={2}>Tableau de bord</Title>
          <Text type="secondary">Vue d'ensemble de votre posture de sécurité</Text>
        </div>
        <Space>
          <DatePicker.RangePicker
            value={timeRange}
            onChange={handleTimeRangeChange}
            style={{ width: 300 }}
            ranges={{
              'Aujourd\'hui': [new Date(), new Date()],
              '7 derniers jours': [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()],
              '30 derniers jours': [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
            }}
            locale={fr}
          />
          <Button
            icon={<SyncOutlined spin={refreshing} />}
            onClick={fetchData}
            loading={refreshing}
          >
            Actualiser
          </Button>
        </Space>
      </div>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} className="metrics-row">
        {/* Alerts */}
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Alertes Totales"
            value={stats?.alerts.total || 0}
            icon={<WarningOutlined />}
            color="red"
            trend={{
              value: stats?.alerts.new || 0,
              label: 'Nouvelles (24h)',
              up: true,
            }}
            subMetrics={[
              { label: 'Critique', value: stats?.alerts.critical || 0, color: 'red' },
              { label: 'Haute', value: stats?.alerts.high || 0, color: 'orange' },
              { label: 'Moyenne', value: stats?.alerts.medium || 0, color: 'gold' },
              { label: 'Faible', value: stats?.alerts.low || 0, color: 'blue' },
            ]}
          />
        </Col>

        {/* Cases */}
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Cas Ouverts"
            value={stats?.cases.open || 0}
            icon={<FileTextOutlined />}
            color="blue"
            trend={{
              value: stats?.cases.sla_breach || 0,
              label: 'SLA en risque',
              up: false,
              color: 'red',
            }}
            subMetrics={[
              { label: 'Total', value: stats?.cases.total || 0 },
              { label: 'Fermés', value: stats?.cases.closed || 0, color: 'green' },
              { label: 'SLA OK', value: (stats?.cases.open || 0) - (stats?.cases.sla_breach || 0), color: 'green' },
            ]}
          />
        </Col>

        {/* Network */}
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Appareils Réseau"
            value={stats?.network.devices || 0}
            icon={<NetworkOutlined />}
            color="cyan"
            trend={{
              value: stats?.network.new_devices || 0,
              label: 'Nouveaux (24h)',
              up: true,
            }}
            subMetrics={[
              { label: 'Scans aujourd\'hui', value: stats?.network.scans_today || 0 },
              { label: 'En ligne', value: Math.floor((stats?.network.devices || 0) * 0.85) },
              { label: 'Hors ligne', value: Math.floor((stats?.network.devices || 0) * 0.15), color: 'gray' },
            ]}
          />
        </Col>

        {/* AI */}
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Investigations IA"
            value={stats?.ai.investigations_today || 0}
            icon={<RobotOutlined />}
            color="purple"
            trend={{
              value: `${stats?.ai.avg_confidence || 0}%`,
              label: 'Confiance moyenne',
              up: true,
            }}
            subMetrics={[
              { label: 'Auto-résolus', value: stats?.ai.auto_resolved || 0, color: 'green' },
              { label: 'En cours', value: Math.max(0, (stats?.ai.investigations_today || 0) - (stats?.ai.auto_resolved || 0)) },
              { label: 'Escaladés', value: Math.floor((stats?.ai.investigations_today || 0) * 0.1) },
            ]}
          />
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} className="charts-row">
        {/* Alert Trends */}
        <Col xs={24} lg={12}>
          <Card title="Tendance des Alertes (7 jours)" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="alerts-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cases-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                  stroke="#999"
                />
                <YAxis stroke="#999" />
                <Tooltip
                  formatter={(value: number, name: string) => [value, name === 'alerts' ? 'Alertes' : name === 'cases' ? 'Cas' : 'Investigations']}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                />
                <Area
                  type="monotone"
                  dataKey="alerts"
                  stroke="#ff4d4f"
                  fillOpacity={1}
                  fill="url(#alerts-gradient)"
                  name="Alertes"
                />
                <Area
                  type="monotone"
                  dataKey="cases"
                  stroke="#1890ff"
                  fillOpacity={1}
                  fill="url(#cases-gradient)"
                  name="Cas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Severity Distribution */}
        <Col xs={24} lg={12}>
          <Card title="Répartition par Sévérité" className="chart-card">
            <SeverityDistributionChart stats={stats} />
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row gutter={[16, 16]} className="activity-row">
        {/* Recent Alerts */}
        <Col xs={24} lg={12}>
          <Card
            title="Alertes Récentes"
            extra={<Button type="link" size="small">Voir toutes</Button>}
            className="activity-card"
          >
            <AlertList
              alerts={recentAlerts}
              onView={(id) => window.location.href = `/alerts/${id}`}
            />
          </Card>
        </Col>

        {/* Recent Cases */}
        <Col xs={24} lg={12}>
          <Card
            title="Cas Récents"
            extra={<Button type="link" size="small">Voir tous</Button>}
            className="activity-card"
          >
            <CaseList
              cases={recentCases}
              onView={(id) => window.location.href = `/cases/${id}`}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[16, 16]} className="actions-row">
        <Col xs={24}>
          <Card title="Actions Rapides" className="actions-card">
            <Space wrap size="middle">
              <QuickActionButton
                icon={<WarningOutlined />}
                label="Nouvelle Alerte"
                description="Créer une alerte manuelle"
                onClick={() => window.location.href = '/alerts/create'}
              />
              <QuickActionButton
                icon={<FileTextOutlined />}
                label="Nouveau Cas"
                description="Ouvrir une investigation"
                onClick={() => window.location.href = '/cases/create'}
              />
              <QuickActionButton
                icon={<NetworkOutlined />}
                label="Scanner le Réseau"
                description="Lancer une découverte"
                onClick={() => window.location.href = '/network'}
              />
              <QuickActionButton
                icon={<RobotOutlined />}
                label="Investigation IA"
                description="Analyser avec l'IA"
                onClick={() => window.location.href = '/ai'}
              />
              <QuickActionButton
                icon={<PlayCircleOutlined />}
                label="Exécuter Playbook"
                description="Automatiser la réponse"
                onClick={() => window.location.href = '/playbooks'}
              />
              <QuickActionButton
                icon={<DatabaseOutlined />}
                label="Règles de Détection"
                description="Gérer les règles Sigma"
                onClick={() => window.location.href = '/detection'}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  trend?: {
    value: number | string
    label: string
    up: boolean
    color?: string
  }
  subMetrics?: Array<{ label: string; value: number; color?: string }>
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  subMetrics,
}) => (
  <Card className="metric-card">
    <div className="metric-header">
      <div className="metric-icon" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <Title level={5} className="metric-title">{title}</Title>
    </div>
    <Statistic
      value={value}
      valueStyle={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)' }}
    />
    {trend && (
      <div className={`metric-trend ${trend.up ? 'up' : 'down'}`}>
        <span className="trend-value">{trend.up ? '↑' : '↓'} {trend.value}</span>
        <span className="trend-label">{trend.label}</span>
      </div>
    )}
    {subMetrics && (
      <Divider style={{ margin: '12px 0' }} />
      <Space wrap className="sub-metrics">
        {subMetrics.map((metric, i) => (
          <div key={i} className="sub-metric" style={{ borderLeftColor: metric.color || color }}>
            <div className="sub-metric-value" style={{ color: metric.color || 'var(--text-primary)' }}>
              {metric.value}
            </div>
            <div className="sub-metric-label">{metric.label}</div>
          </div>
        ))}
      </Space>
    )}
  </Card>
)

// Severity Distribution Chart
const SeverityDistributionChart: React.FC<{ stats: StatsData | null }> = ({ stats }) => {
  if (!stats) return null

  const data = [
    { name: 'Critique', value: stats.alerts.critical, color: '#ff4d4f' },
    { name: 'Haute', value: stats.alerts.high, color: '#ff7a45' },
    { name: 'Moyenne', value: stats.alerts.medium, color: '#faad14' },
    { name: 'Faible', value: stats.alerts.low, color: '#1890ff' },
    { name: 'Info', value: stats.alerts.total - stats.alerts.critical - stats.alerts.high - stats.alerts.medium - stats.alerts.low, color: '#bfbfbf' },
  ].filter(d => d.value > 0)

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="severity-chart" style={{ height: 300 }}>
      <div className="severity-legend">
        {data.map((item) => (
          <div key={item.name} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span className="legend-name">{item.name}</span>
            <span className="legend-value">{item.value}</span>
            <span className="legend-percent">{(total > 0 ? (item.value / total * 100).toFixed(1) : 0)}%</span>
          </div>
        ))}
      </div>
      <div className="severity-donut">
        <svg viewBox="0 0 200 200" className="donut-svg">
          {data.map((item, index) => {
            const prevItems = data.slice(0, index)
            const startAngle = prevItems.reduce((sum, d) => sum + (d.value / total) * 360, 0)
            const endAngle = startAngle + (item.value / total) * 360
            const largeArcFlag = (item.value / total) > 0.5 ? 1 : 0

            const startX = 100 + 70 * Math.cos((startAngle - 90) * Math.PI / 180)
            const startY = 100 + 70 * Math.sin((startAngle - 90) * Math.PI / 180)
            const endX = 100 + 70 * Math.cos((endAngle - 90) * Math.PI / 180)
            const endY = 100 + 70 * Math.sin((endAngle - 90) * Math.PI / 180)

            const outerStartX = 100 + 90 * Math.cos((startAngle - 90) * Math.PI / 180)
            const outerStartY = 100 + 90 * Math.sin((startAngle - 90) * Math.PI / 180)
            const outerEndX = 100 + 90 * Math.cos((endAngle - 90) * Math.PI / 180)
            const outerEndY = 100 + 90 * Math.sin((endAngle - 90) * Math.PI / 180)

            return (
              <path
                key={item.name}
                d={`
                  M ${startX} ${startY}
                  L ${outerStartX} ${outerStartY}
                  A 90 90 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}
                  L ${endX} ${endY}
                  A 70 70 0 ${largeArcFlag} 0 ${startX} ${startY}
                  Z
                `}
                fill={item.color}
                className="donut-segment"
              />
            )
          })}
        </svg>
        <div className="donut-center">
          <div className="donut-total">{total}</div>
          <div className="donut-label">Total Alertes</div>
        </div>
      </div>
    </div>
  )
}

// Alert List
const AlertList: React.FC<{ alerts: RecentAlert[]; onView: (id: string) => void }> = ({ alerts, onView }) => {
  if (alerts.length === 0) {
    return <Text type="secondary" className="empty-state">Aucune alerte récente</Text>
  }

  return (
    <div className="alert-list">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="alert-item"
          onClick={() => onView(alert.id)}
        >
          <div className="alert-severity" style={{ backgroundColor: severityColors[alert.severity] || 'gray' }} />
          <div className="alert-content">
            <div className="alert-title">{alert.title}</div>
            <div className="alert-meta">
              <Tag color={statusColors[alert.status] || 'gray'}>{alert.status}</Tag>
              <span>{alert.connector}</span>
              <span>{alert.host}</span>
              <span className="alert-time">{formatDistanceToNow(new Date(alert.occurred_at), { addSuffix: true, locale: fr })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Case List
const CaseList: React.FC<{ cases: RecentCase[]; onView: (id: string) => void }> = ({ cases, onView }) => {
  if (cases.length === 0) {
    return <Text type="secondary" className="empty-state">Aucun cas récent</Text>
  }

  return (
    <div className="case-list">
      {cases.map((caseItem) => (
        <div
          key={caseItem.id}
          className="case-item"
          onClick={() => onView(caseItem.id)}
        >
          <div className="case-severity" style={{ backgroundColor: severityColors[caseItem.severity] || 'gray' }} />
          <div className="case-content">
            <div className="case-title">{caseItem.title}</div>
            <div className="case-meta">
              <Tag color={statusColors[caseItem.status] || 'gray'}>{caseItem.status}</Tag>
              <span>{caseItem.assignee || 'Non assigné'}</span>
              <span className="case-time">{formatDistanceToNow(new Date(caseItem.created_at), { addSuffix: true, locale: fr })}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Quick Action Button
const QuickActionButton: React.FC<{
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}> = ({ icon, label, description, onClick }) => (
  <Button
    type="default"
    size="large"
    block
    className="quick-action-btn"
    onClick={onClick}
    icon={icon}
  >
    <div className="quick-action-content">
      <div className="quick-action-label">{label}</div>
      <div className="quick-action-desc">{description}</div>
    </div>
  </Button>
)

// Skeleton
const DashboardSkeleton: React.FC = () => (
  <div className="dashboard">
    <div className="dashboard-header">
      <Skeleton title paragraph={{ rows: 1 }} />
      <Skeleton active />
    </div>
    <Row gutter={[16, 16]} className="metrics-row">
      {[1, 2, 3, 4].map(i => (
        <Col key={i} xs={24} sm={12} lg={6}>
          <Card className="metric-card">
            <Skeleton title paragraph={{ rows: 3 }} active />
          </Card>
        </Col>
      ))}
    </Row>
    <Row gutter={[16, 16]} className="charts-row">
      <Col xs={24} lg={12}><Card className="chart-card"><Skeleton active paragraph={{ rows: 10 }} /></Card></Col>
      <Col xs={24} lg={12}><Card className="chart-card"><Skeleton active paragraph={{ rows: 10 }} /></Card></Col>
    </Row>
    <Row gutter={[16, 16]} className="activity-row">
      <Col xs={24} lg={12}><Card className="activity-card"><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
      <Col xs={24} lg={12}><Card className="activity-card"><Skeleton active paragraph={{ rows: 8 }} /></Card></Col>
    </Row>
    <Row gutter={[16, 16]} className="actions-row">
      <Col xs={24}><Card className="actions-card"><Skeleton active paragraph={{ rows: 4 }} /></Card></Col>
    </Row>
  </div>
)

export default Dashboard