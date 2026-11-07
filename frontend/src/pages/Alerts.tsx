import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Dropdown, Menu,
  Modal, Form, Input, Select, DatePicker, Tooltip, Popconfirm,
  Spin, Empty, Tabs, Divider, Checkbox, Radio, Slider
} from 'antd'
import {
  SearchOutlined, FilterOutlined, SyncOutlined, DownloadOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, MoreOutlined,
  WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  RightOutlined, LeftOutlined, FileTextOutlined, UserOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { useAuth } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './Alerts.scss'

const { Column, ColumnGroup } = Table
const { Option } = Select
const { TextArea } = Input

interface Alert {
  id: string
  alert_id: string
  title: string
  description: string
  severity: string
  status: string
  connector: string
  connector_name: string
  host: string
  user: string
  source_ip: string
  destination_ip: string
  mitre_techniques: string[]
  mitre_tactics: string[]
  iocs: Record<string, any>
  assigned_to: string
  assigned_to_detail: { email: string; full_name: string } | null
  occurred_at: string
  received_at: string
  triaged_at: string
  tags: string[]
  comments_count: number
  attachments_count: number
}

interface AlertStats {
  total: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  by_connector: Record<string, number>
  unassigned: number
  overdue: number
}

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

const Alerts: React.FC = () => {
  const { user, permissions } = useAuth()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [sorter, setSorter] = useState<{ field: string; order: string }>({ field: 'occurred_at', order: 'descend' })
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([])
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [triageModalVisible, setTriageModalVisible] = useState(false)
  const [triageForm] = Form.useForm()
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Fetch alerts
  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ordering: `${sorter.order === 'descend' ? '-' : ''}${sorter.field}`,
        ...filters,
      }
      const [alertsRes, statsRes] = await Promise.all([
        api.get('/alerts/alerts/', { params }),
        api.get('/alerts/alerts/stats/'),
      ])
      setAlerts(alertsRes.results || [])
      setPagination(prev => ({ ...prev, total: alertsRes.count || 0 }))
      setStats(statsRes)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [pagination.current, pagination.pageSize, sorter, filters])

  // Table change handlers
  const handleTableChange = (newPagination: any, newFilters: any, newSorter: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
    setFilters(newFilters)
    if (newSorter.field) {
      setSorter({ field: newSorter.field, order: newSorter.order })
    }
  }

  const handleSelectionChange = (selectedRowKeys: string[]) => {
    setSelectedAlerts(selectedRowKeys)
  }

  // Row click
  const handleRowClick = (record: Alert) => {
    setSelectedAlert(record)
    setDetailModalVisible(true)
  }

  // Triage
  const handleTriage = async (alert: Alert) => {
    setSelectedAlert(alert)
    triageForm.setFieldsValue({
      status: alert.status,
      assigned_to: alert.assigned_to || '',
    })
    setTriageModalVisible(true)
  }

  const handleTriageSubmit = async (values: any) => {
    if (!selectedAlert) return
    try {
      await api.post(`/alerts/alerts/${selectedAlert.id}/triage/`, values)
      setTriageModalVisible(false)
      fetchAlerts()
    } catch (error) {
      console.error('Triage failed:', error)
    }
  }

  // Bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedAlerts.length === 0) return
    setBulkActionLoading(true)
    try {
      await api.post('/alerts/alerts/bulk_action/', {
        alert_ids: selectedAlerts,
        action,
        parameters: {},
      })
      setSelectedAlerts([])
      fetchAlerts()
    } catch (error) {
      console.error('Bulk action failed:', error)
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Get dropdown menu for each row
  const getRowMenu = (alert: Alert) => [
    { key: 'view', label: 'Voir détails', icon: <EyeOutlined />, onClick: () => handleRowClick(alert) },
    { key: 'triage', label: 'Qualifier', icon: <EditOutlined />, onClick: () => handleTriage(alert), disabled: !permissions?.includes('alerts.change_alert') },
    { type: 'divider' as const },
    { key: 'assign_me', label: 'M\'assigner', icon: <UserOutlined />, onClick: () => handleAssign(alert, user?.id), disabled: !user || alert.assigned_to === user?.id },
    { key: 'unassign', label: 'Désassigner', icon: <UserOutlined />, onClick: () => handleAssign(alert, null), disabled: !alert.assigned_to },
    { type: 'divider' as const },
    { key: 'false_positive', label: 'Marquer faux positif', icon: <CheckCircleOutlined />, onClick: () => handleStatusChange(alert, 'false_positive'), danger: true },
    { key: 'duplicate', label: 'Marquer doublon', icon: <CopyOutlined />, onClick: () => handleStatusChange(alert, 'duplicate') },
  ]

  const handleAssign = async (alert: Alert, userId: string | null) => {
    try {
      await api.patch(`/alerts/alerts/${alert.id}/`, { assigned_to: userId })
      fetchAlerts()
    } catch (error) {
      console.error('Assign failed:', error)
    }
  }

  const handleStatusChange = async (alert: Alert, status: string) => {
    try {
      await api.post(`/alerts/alerts/${alert.id}/triage/`, { status })
      fetchAlerts()
    } catch (error) {
      console.error('Status change failed:', error)
    }
  }

  // Renderers
  const renderSeverity = (severity: string) => (
    <Tag color={severityColors[severity] || 'default'}>
      {severity.toUpperCase()}
    </Tag>
  )

  const renderStatus = (status: string) => (
    <Tag color={statusColors[status] || 'default'}>
      {status.replace('_', ' ')}
    </Tag>
  )

  const renderMITRE = (techniques: string[]) => (
    <Space wrap size={4}>
      {techniques.slice(0, 3).map(t => (
        <Tag key={t} color="blue">{t}</Tag>
      ))}
      {techniques.length > 3 && <Tag color="gray">+{techniques.length - 3}</Tag>}
    </Space>
  )

  const renderIOCs = (iocs: Record<string, any>) => {
    const count = Object.keys(iocs).length
    if (count === 0) return <span style={{ color: '#999' }}>Aucun</span>
    return (
      <Tag color="purple" onClick={() => console.log(iocs)}>
        {count} IOC{count > 1 ? 's' : ''}
      </Tag>
    )
  }

  const columns = [
    {
      title: 'Sévérité',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: renderSeverity,
      sorter: true,
      filters: Object.keys(severityColors).map(s => ({ text: s, value: s })),
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: renderStatus,
      sorter: true,
      filters: Object.keys(statusColors).map(s => ({ text: s.replace('_', ' '), value: s })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Titre',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Alert) => (
        <span onClick={() => handleRowClick(record)} style={{ cursor: 'pointer' }}>
          {text}
          {record.tags.length > 0 && (
            <Space style={{ marginLeft: 8 }}>
              {record.tags.slice(0, 2).map(tag => (
                <Tag key={tag} color="geekblue" size="small">{tag}</Tag>
              ))}
              {record.tags.length > 2 && <Tag size="small">+{record.tags.length - 2}</Tag>}
            </Space>
          )}
        </span>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'connector_name',
      key: 'connector',
      width: 150,
      sorter: true,
      filters: [],
      onFilter: (value, record) => record.connector === value,
    },
    {
      title: 'Hôte / Utilisateur',
      key: 'host_user',
      width: 200,
      render: (_, record: Alert) => (
        <div>
          {record.host && <div><UserOutlined style={{ marginRight: 4 }} /> {record.host}</div>}
          {record.user && <div><UserOutlined style={{ marginRight: 4 }} /> {record.user}</div>}
          {record.source_ip && <div><GlobalOutlined style={{ marginRight: 4 }} /> {record.source_ip}</div>}
        </div>
      ),
    },
    {
      title: 'MITRE ATT&CK',
      key: 'mitre',
      width: 200,
      render: (_, record: Alert) => renderMITRE(record.mitre_techniques || []),
    },
    {
      title: 'IOCs',
      key: 'iocs',
      width: 100,
      render: (_, record: Alert) => renderIOCs(record.iocs || {}),
    },
    {
      title: 'Assigné',
      dataIndex: 'assigned_to_detail',
      key: 'assigned_to',
      width: 150,
      render: (detail: any) => detail ? `${detail.full_name} (${detail.email})` : <span style={{ color: '#999' }}>Non assigné</span>,
    },
    {
      title: 'Date',
      dataIndex: 'occurred_at',
      key: 'occurred_at',
      width: 160,
      sorter: true,
      render: (date: string) => (
        <div>
          <div>{new Date(date).toLocaleString('fr-FR')}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })}
          </div>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record: Alert) => (
        <Dropdown
          menu={{ items: getRowMenu(record) }}
          placement="bottomRight"
          trigger={['click']}
        >
          <Button type="link" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <div className="alerts-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Typography.Title level={2}>Alertes de Sécurité</Typography.Title>
          <Typography.Text type="secondary">
            {stats?.total || 0} alertes au total • {stats?.unassigned || 0} non assignées • {stats?.overdue || 0} en retard
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Exporter</Button>
          <Button icon={<SyncOutlined />} onClick={fetchAlerts} loading={loading}>Actualiser</Button>
        </Space>
      </div>

      {/* Stats Bar */}
      <Card className="stats-bar">
        <Space wrap>
          <StatItem label="Total" value={stats?.total || 0} />
          <StatItem label="Critique" value={stats?.by_severity?.critical || 0} color="red" />
          <StatItem label="Haute" value={stats?.by_severity?.high || 0} color="orange" />
          <StatItem label="Moyenne" value={stats?.by_severity?.medium || 0} color="gold" />
          <StatItem label="Faible" value={stats?.by_severity?.low || 0} color="blue" />
          <Divider type="vertical" />
          <StatItem label="Nouvelles" value={stats?.by_status?.new || 0} color="blue" />
          <StatItem label="En cours" value={stats?.by_status?.investigating || 0} color="orange" />
          <StatItem label="Résolues" value={stats?.by_status?.resolved || 0} color="green" />
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedAlerts.length > 0 && (
        <Card className="bulk-action-bar">
          <Space>
            <Typography.Text> {selectedAlerts.length} alertes sélectionnées </Typography.Text>
            <Button icon={<UserOutlined />} onClick={() => handleBulkAction('assign')}>Assigner</Button>
            <Button icon={<EditOutlined />} onClick={() => handleBulkAction('change_status')}>Changer statut</Button>
            <Button icon={<TagOutlined />} onClick={() => handleBulkAction('add_tags')}>Ajouter tags</Button>
            <Popconfirm title="Marquer comme faux positif ?" onConfirm={() => handleBulkAction('mark_false_positive')} okText="Oui" cancelText="Non">
              <Button danger icon={<CheckCircleOutlined />}>Faux positif</Button>
            </Popconfirm>
            <Button onClick={() => setSelectedAlerts([])}>Annuler</Button>
          </Space>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          pagination={pagination}
          sorter={sorter}
          filters={filters}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys: selectedAlerts,
            onChange: handleSelectionChange,
            columnWidth: 40,
          }}
          loading={loading}
          rowClassName={(record: Alert) => `severity-${record.severity}`}
          onRow={(record: Alert) => ({
            onClick: () => handleRowClick(record),
          })}
          expandedRowRender={(record: Alert) => (
            <div className="expanded-row">
              <Space wrap>
                <div><strong>Description:</strong> {record.description || 'Aucune description'}</div>
                <div><strong>MITRE Tactics:</strong> {record.mitre_tactics.join(', ') || 'Aucun'}</div>
                <div><strong>Commentaires:</strong> {record.comments_count} • <strong>Pièces jointes:</strong> {record.attachments_count}</div>
              </Space>
            </div>
          )}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Détails de l'Alerte"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>Fermer</Button>,
          <Button key="triage" type="primary" onClick={() => handleTriage(selectedAlert!)}>Qualifier</Button>,
        ]}
        destroyOnClose
      >
        {selectedAlert && <AlertDetail alert={selectedAlert} />}
      </Modal>

      {/* Triage Modal */}
      <Modal
        title="Qualifier l'Alerte"
        open={triageModalVisible}
        onCancel={() => setTriageModalVisible(false)}
        onOk={() => triageForm.validateFields().then(handleTriageSubmit).catch(() => {})}
        width={500}
        form={triageForm}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item name="status" label="Statut" rules={[{ required: true }]}>
            <Select>
              {Object.entries(statusColors).map(([value, color]) => (
                <Option key={value} value={value}>{value.replace('_', ' ')}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="assigned_to" label="Assigner à">
            <Select
              placeholder="Sélectionner un utilisateur"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => (option?.children as string)?.toLowerCase().includes(input.toLowerCase())}
            >
              {/* Users would be loaded here */}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Ajouter des tags" />
          </Form.Item>
          <Form.Item name="comment" label="Commentaire">
            <TextArea rows={3} placeholder="Commentaire interne..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

const StatItem: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div className="stat-item">
    <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
    <div className="stat-label">{label}</div>
  </div>
)

const AlertDetail: React.FC<{ alert: Alert }> = ({ alert }) => (
  <div className="alert-detail">
    <div className="detail-header">
      <Tag color={severityColors[alert.severity] || 'default'} size="large">{alert.severity.toUpperCase()}</Tag>
      <Tag color={statusColors[alert.status] || 'default'} size="large">{alert.status.replace('_', ' ')}</Tag>
    </div>

    <Typography.Title level={4}>{alert.title}</Typography.Title>
    <Typography.Text type="secondary">{alert.description || 'Aucune description'}</Typography.Text>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={12} sm={6}>
        <DetailField label="ID Alerte" value={alert.alert_id} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Source" value={alert.connector_name} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Hôte" value={alert.host || 'N/A'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Utilisateur" value={alert.user || 'N/A'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="IP Source" value={alert.source_ip || 'N/A'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="IP Destination" value={alert.destination_ip || 'N/A'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Date survenue" value={new Date(alert.occurred_at).toLocaleString('fr-FR')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Date réception" value={new Date(alert.received_at).toLocaleString('fr-FR')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Assigné à" value={alert.assigned_to_detail?.full_name || 'Non assigné'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Tags" value={alert.tags.join(', ') || 'Aucun'} />
      </Grid>
    </Grid>

    {alert.mitre_techniques.length > 0 && (
      <Divider />
      <Typography.Title level={5}>MITRE ATT&CK</Typography.Title>
      <Space wrap>
        {alert.mitre_techniques.map(t => (
          <Tag key={t} color="blue">{t}</Tag>
        ))}
      </Space>
    )}

    {Object.keys(alert.iocs || {}).length > 0 && (
      <Divider />
      <Typography.Title level={5}>Indicateurs de Compromission (IOCs)</Typography.Title>
      <Space wrap>
        {Object.entries(alert.iocs).map(([type, values]) => (
          <Tag key={type} color="purple">{type}: {Array.isArray(values) ? values.join(', ') : values}</Tag>
        ))}
      </Space>
    )}
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

const handleExport = () => {
  // Export logic
}

export default Alerts