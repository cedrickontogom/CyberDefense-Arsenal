import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Modal, Form,
  Input, Select, Tabs, Typography, Spin, Tooltip, Popconfirm,
  Dropdown, Menu, List, Avatar, Divider, Switch, Alert, Steps
} from 'antd'
import {
  DatabaseOutlined, SyncOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, CopyOutlined, DownloadOutlined,
  WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined, SearchOutlined, FilterOutlined, SettingOutlined,
  PlayCircleOutlined, StopOutlined, CodeOutlined, CloudOutlined,
  ServerOutlined, SafetyOutlined, UserOutlined, KeyOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './Connectors.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { TextArea } = Input

interface Connector {
  id: string
  name: string
  connector_type: string
  status: string
  config: Record<string, any>
  mapping_rules: Record<string, any>
  schedule: Record<string, any>
  last_run: string
  last_success: string
  last_error: string
  total_events: number
  events_last_hour: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const CONNECTOR_TYPES = [
  { value: 'webhook', label: 'Webhook', icon: <GlobalOutlined /> },
  { value: 'splunk', label: 'Splunk', icon: <DatabaseOutlined /> },
  { value: 'elastic', label: 'Elastic/SIEM', icon: <DatabaseOutlined /> },
  { value: 'crowdstrike', label: 'CrowdStrike', icon: <SafetyOutlined /> },
  { value: 'sentinel', label: 'Microsoft Sentinel', icon: <CloudOutlined /> },
  { value: 'okta', label: 'Okta', icon: <UserOutlined /> },
  { value: 'aws', label: 'AWS CloudTrail', icon: <CloudOutlined /> },
  { value: 'gcp', label: 'GCP Cloud Logging', icon: <CloudOutlined /> },
  { value: 'azure', label: 'Azure Event Hubs', icon: <CloudOutlined /> },
  { value: 'syslog', label: 'Syslog/CEF', icon: <ServerOutlined /> },
  { value: 'defender', label: 'Microsoft Defender', icon: <SafetyOutlined /> },
  { value: 'sentinelone', label: 'SentinelOne', icon: <SafetyOutlined /> },
  { value: 'cortex_xdr', label: 'Cortex XDR', icon: <SafetyOutlined /> },
  { value: 'generic', label: 'API Générique', icon: <CodeOutlined /> },
]

const Connectors: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [connectorForm] = Form.useForm()
  const [createStep, setCreateStep] = useState(0)
  const [selectedType, setSelectedType] = useState<string>('')
  const [testResult, setTestResult] = useState<any>(null)

  const fetchConnectors = async () => {
    setLoading(true)
    try {
      const res = await api.get('/alerts/connectors/', { params: { page: pagination.current, page_size: pagination.pageSize } })
      setConnectors(res.results || [])
      setPagination(prev => ({ ...prev, total: res.count || 0 }))
    } catch (error) {
      console.error('Failed to fetch connectors:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnectors()
  }, [pagination.current, pagination.pageSize])

  const handleTableChange = (newPagination: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
  }

  const handleCreateConnector = async (values: any) => {
    try {
      await api.post('/alerts/connectors/', { ...values, connector_type: selectedType })
      setCreateModalVisible(false)
      setCreateStep(0)
      setSelectedType('')
      connectorForm.resetFields()
      fetchConnectors()
    } catch (error) {
      console.error('Failed to create connector:', error)
    }
  }

  const handleTestConnector = async (connector: Connector) => {
    try {
      const res = await api.post(`/alerts/connectors/${connector.id}/test/`)
      setTestResult(res)
    } catch (error: any) {
      setTestResult({ success: false, error: error.response?.data?.error?.message || 'Test failed' })
    }
  }

  const handleToggleActive = async (connector: Connector) => {
    try {
      await api.patch(`/alerts/connectors/${connector.id}/`, { is_active: !connector.is_active })
      fetchConnectors()
    } catch (error) {
      console.error('Failed to toggle connector:', error)
    }
  }

  const handleDeleteConnector = async (connector: Connector) => {
    try {
      await api.delete(`/alerts/connectors/${connector.id}/`)
      fetchConnectors()
    } catch (error) {
      console.error('Failed to delete connector:', error)
    }
  }

  const renderStatus = (status: string) => {
    const colors: Record<string, string> = { active: 'green', inactive: 'gray', error: 'red', pending: 'orange' }
    return <Tag color={colors[status] || 'default'}>{status}</Tag>
  }

  const getTypeInfo = (type: string) => CONNECTOR_TYPES.find(t => t.value === type) || { label: type, icon: <CodeOutlined /> }

  return (
    <div className="connectors-page">
      <div className="page-header">
        <div>
          <Title level={2}>Connecteurs de Données</Title>
          <Text type="secondary">Intégration avec vos outils de sécurité (SIEM, EDR, Cloud, etc.)</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchConnectors} loading={loading}>Actualiser</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalVisible(true)}>
            Nouveau Connecteur
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={connectors}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          columns={[
            {
              title: 'Nom',
              dataIndex: 'name',
              key: 'name',
              width: 200,
              render: (n: string, record: Connector) => (
                <Space>
                  {getTypeInfo(record.connector_type).icon}
                  <strong>{n}</strong>
                </Space>
              ),
            },
            {
              title: 'Type',
              dataIndex: 'connector_type',
              key: 'connector_type',
              width: 150,
              render: (t: string) => getTypeInfo(t).label,
            },
            {
              title: 'Statut',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: renderStatus,
            },
            {
              title: 'Actif',
              dataIndex: 'is_active',
              key: 'is_active',
              width: 80,
              render: (active: boolean) => (
                <Switch checked={active} onChange={() => handleToggleActive({ ...arguments[0] as any, is_active: active })} size="small" />
              ),
            },
            {
              title: 'Dernière exécution',
              dataIndex: 'last_run',
              key: 'last_run',
              width: 160,
              render: (d: string) => d ? new Date(d).toLocaleString('fr-FR') : 'Jamais',
            },
            {
              title: 'Dernier succès',
              dataIndex: 'last_success',
              key: 'last_success',
              width: 160,
              render: (d: string) => d ? new Date(d).toLocaleString('fr-FR') : 'Jamais',
            },
            {
              title: 'Événements (1h)',
              dataIndex: 'events_last_hour',
              key: 'events_last_hour',
              width: 120,
              align: 'center',
            },
            {
              title: 'Total événements',
              dataIndex: 'total_events',
              key: 'total_events',
              width: 120,
              align: 'center',
            },
            {
              title: 'Erreur',
              dataIndex: 'last_error',
              key: 'last_error',
              render: (e: string) => e ? <Tag color="red">{e}</Tag> : <span style={{ color: '#999' }}>Aucune</span>,
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 180,
              fixed: 'right',
              render: (_, record: Connector) => (
                <Space>
                  <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedConnector(record); setDetailModalVisible(true) }}>Voir</Button>
                  <Button type="link" size="small" icon={<PlayOutlined />} onClick={() => handleTestConnector(record)}>Tester</Button>
                  <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => { setSelectedConnector(record); setCreateStep(1); setSelectedType(record.connector_type); setCreateModalVisible(true) }}>Configurer</Button>
                  <Popconfirm title="Supprimer ce connecteur ?" onConfirm={() => handleDeleteConnector(record)} okText="Oui" cancelText="Non">
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>Supprimer</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Connector Modal - Step 1: Select Type */}
      <Modal
        title="Nouveau Connecteur"
        open={createModalVisible}
        onCancel={() => { setCreateModalVisible(false); setCreateStep(0); setSelectedType('') }}
        width={700}
        footer={createStep === 0 ? [
          <Button key="next" type="primary" onClick={() => { if (selectedType) setCreateStep(1) }}>Suivant</Button>,
        ] : createStep === 1 ? [
          <Button key="prev" onClick={() => setCreateStep(0)}>Précédent</Button>,
          <Button key="submit" type="primary" onClick={() => connectorForm.validateFields().then(handleCreateConnector).catch(() => {})}>Créer</Button>,
        ] : []}
        destroyOnClose
      >
        {createStep === 0 && (
          <div className="connector-type-selector">
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Sélectionnez le type de connecteur à configurer
            </Text>
            <div className="type-grid">
              {CONNECTOR_TYPES.map(type => (
                <div
                  key={type.value}
                  className={`type-card ${selectedType === type.value ? 'selected' : ''}`}
                  onClick={() => setSelectedType(type.value)}
                >
                  <div className="type-icon">{type.icon}</div>
                  <div className="type-label">{type.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {createStep === 1 && (
          <Form form={connectorForm} layout="vertical">
            <Alert message={`Configuration pour ${getTypeInfo(selectedType).label}`} type="info" showIcon />
            <Form.Item name="name" label="Nom" rules={[{ required: true }]}>
              <Input placeholder="Nom du connecteur" />
            </Form.Item>
            <Form.Item name="config" label="Configuration (JSON)" rules={[{ required: true }]}>
              <TextArea rows={10} placeholder='{"api_url": "https://...", "api_key": "..."}' style={{ fontFamily: 'monospace', width: '100%' }} />
            </Form.Item>
            <Form.Item name="mapping_rules" label="Règles de mapping (JSON)">
              <TextArea rows={5} placeholder='{"title": "$.title", "severity": "$.severity"}' style={{ fontFamily: 'monospace', width: '100%' }} />
            </Form.Item>
            <Form.Item name="schedule" label="Planification (JSON)">
              <TextArea rows={3} placeholder='{"cron": "*/5 * * * *"}' style={{ fontFamily: 'monospace', width: '100%' }} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Détails du Connecteur"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedConnector(null) }}
        width={800}
        destroyOnClose
      >
        {selectedConnector && <ConnectorDetail connector={selectedConnector} onTest={handleTestConnector} testResult={testResult} />}
      </Modal>
    </div>
  )
}

const ConnectorDetail: React.FC<{ connector: Connector; onTest: (c: Connector) => void; testResult: any }> = ({ connector, onTest, testResult }) => (
  <div className="connector-detail">
    <div className="detail-header">
      <Space>
        {getTypeInfo(connector.connector_type).icon}
        <Tag color={connector.status === 'active' ? 'green' : connector.status === 'error' ? 'red' : 'orange'} size="large">{connector.status}</Tag>
        <Switch checked={connector.is_active} size="small" />
      </Space>
    </div>

    <Title level={4}>{connector.name}</Title>
    <Tag color="blue">{getTypeInfo(connector.connector_type).label}</Tag>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={6}><DetailField label="Dernière exécution" value={connector.last_run ? new Date(connector.last_run).toLocaleString('fr-FR') : 'Jamais'} /></Grid>
      <Grid item xs={6}><DetailField label="Dernier succès" value={connector.last_success ? new Date(connector.last_success).toLocaleString('fr-FR') : 'Jamais'} /></Grid>
      <Grid item xs={6}><DetailField label="Événements (1h)" value={connector.events_last_hour.toString()} /></Grid>
      <Grid item xs={6}><DetailField label="Total événements" value={connector.total_events.toString()} /></Grid>
    </Grid>

    {connector.last_error && (
      <>
        <Divider />
        <Alert message="Dernière erreur" description={connector.last_error} type="error" showIcon />
      </>
    )}

    <Divider />

    <Title level={5}>Configuration</Title>
    <TextArea rows={10} value={JSON.stringify(connector.config, null, 2)} readOnly style={{ fontFamily: 'monospace', width: '100%' }} />

    <Divider />

    <Title level={5}>Règles de Mapping</Title>
    <TextArea rows={5} value={JSON.stringify(connector.mapping_rules, null, 2)} readOnly style={{ fontFamily: 'monospace', width: '100%' }} />

    <Divider />

    <Space>
      <Button icon={<PlayOutlined />} type="primary" onClick={() => onTest(connector)}>Tester la connexion</Button>
      {testResult && testResult.success && <Tag color="green"><CheckCircleOutlined /> Connexion réussie</Tag>}
      {testResult && !testResult.success && <Tag color="red"><ExclamationCircleOutlined /> {testResult.error || 'Échec'}</Tag>}
    </Space>
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

export default Connectors