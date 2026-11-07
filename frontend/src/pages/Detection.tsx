import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Modal, Form,
  Input, Select, Tabs, Typography, Spin, Tooltip, Popconfirm,
  Dropdown, Menu, List, Avatar, Divider, Switch, Alert, Drawer
} from 'antd'
import {
  DatabaseOutlined, SyncOutlined, PlusOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, CopyOutlined, DownloadOutlined,
  WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  FileTextOutlined, SearchOutlined, FilterOutlined, SettingOutlined,
  PlayCircleOutlined, StopOutlined, CodeOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { useAuth } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './Detection.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { TextArea } = Input

interface DetectionRule {
  id: string
  name: string
  description: string
  severity: string
  status: string
  source: string
  rule_type: string
  mitre_techniques: string[]
  mitre_tactics: string[]
  logic: string
  created_by: string
  created_at: string
  updated_at: string
  matches_24h: number
  false_positive_rate: number
}

interface RuleStats {
  total: number
  active: number
  by_severity: Record<string, number>
  by_source: Record<string, number>
  by_type: Record<string, number>
}

const Detection: React.FC = () => {
  const { permissions } = useAuth()
  const [rules, setRules] = useState<DetectionRule[]>([])
  const [stats, setStats] = useState<RuleStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedRule, setSelectedRule] = useState<DetectionRule | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [ruleForm] = Form.useForm()
  const [editorVisible, setEditorVisible] = useState(false)
  const [editorRule, setEditorRule] = useState<DetectionRule | null>(null)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const [rulesRes, statsRes] = await Promise.all([
        api.get('/detection/rules/', { params: { page: pagination.current, page_size: pagination.pageSize, ...filters } }),
        api.get('/detection/rules/stats/'),
      ])
      setRules(rulesRes.results || [])
      setPagination(prev => ({ ...prev, total: rulesRes.count || 0 }))
      setStats(statsRes)
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [pagination.current, pagination.pageSize, filters])

  const handleTableChange = (newPagination: any, newFilters: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
    setFilters(newFilters)
  }

  const handleCreateRule = async (values: any) => {
    try {
      await api.post('/detection/rules/', values)
      setCreateModalVisible(false)
      ruleForm.resetFields()
      fetchRules()
    } catch (error) {
      console.error('Failed to create rule:', error)
    }
  }

  const handleToggleStatus = async (rule: DetectionRule) => {
    try {
      await api.patch(`/detection/rules/${rule.id}/`, { status: rule.status === 'active' ? 'inactive' : 'active' })
      fetchRules()
    } catch (error) {
      console.error('Failed to toggle rule status:', error)
    }
  }

  const handleTestRule = async (rule: DetectionRule) => {
    // Test rule logic
  }

  const renderSeverity = (severity: string) => (
    <Tag color={severity === 'critical' ? 'red' : severity === 'high' ? 'orange' : severity === 'medium' ? 'gold' : 'blue'}>
      {severity.toUpperCase()}
    </Tag>
  )

  const renderStatus = (status: string) => {
    const colors: Record<string, string> = { active: 'green', inactive: 'gray', draft: 'blue', testing: 'orange' }
    return <Tag color={colors[status] || 'default'}>{status}</Tag>
  }

  const renderSource = (source: string) => {
    const colors: Record<string, string> = { sigma: 'blue', custom: 'purple', imported: 'orange', builtin: 'green' }
    return <Tag color={colors[source] || 'default'}>{source}</Tag>
  }

  return (
    <div className="detection-page">
      <div className="page-header">
        <div>
          <Title level={2}>Moteur de Détection</Title>
          <Text type="secondary">Règles Sigma, détection personnalisée et corrélation</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchRules} loading={loading}>Actualiser</Button>
          <Button icon={<DownloadOutlined />}>Exporter</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalVisible(true)}>
            Nouvelle Règle
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} className="stats-row" style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Total Règles" value={stats?.total || 0} icon={<DatabaseOutlined />} color="blue" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Actives" value={stats?.active || 0} icon={<CheckCircleOutlined />} color="green" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Sigma" value={stats?.by_source?.sigma || 0} icon={<CodeOutlined />} color="purple" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Personnalisées" value={stats?.by_source?.custom || 0} icon={<EditOutlined />} color="orange" />
        </Col>
      </Row>

      {/* Rules Table */}
      <Card>
        <Table
          dataSource={rules}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          rowSelection={{ columnWidth: 40 }}
          columns={[
            {
              title: 'Nom',
              dataIndex: 'name',
              key: 'name',
              width: 200,
              render: (n: string) => <strong>{n}</strong>,
            },
            {
              title: 'Sévérité',
              dataIndex: 'severity',
              key: 'severity',
              width: 100,
              render: renderSeverity,
              filters: ['critical', 'high', 'medium', 'low', 'info'].map(s => ({ text: s, value: s })),
              onFilter: (value, record) => record.severity === value,
            },
            {
              title: 'Statut',
              dataIndex: 'status',
              key: 'status',
              width: 100,
              render: renderStatus,
              filters: ['active', 'inactive', 'draft', 'testing'].map(s => ({ text: s, value: s })),
              onFilter: (value, record) => record.status === value,
            },
            {
              title: 'Source',
              dataIndex: 'source',
              key: 'source',
              width: 100,
              render: renderSource,
            },
            {
              title: 'Type',
              dataIndex: 'rule_type',
              key: 'rule_type',
              width: 120,
            },
            {
              title: 'MITRE',
              key: 'mitre',
              width: 150,
              render: (_, record: DetectionRule) => (
                <Space wrap size={4}>
                  {record.mitre_techniques.slice(0, 3).map(t => <Tag key={t} color="blue" size="small">{t}</Tag>)}
                  {record.mitre_techniques.length > 3 && <Tag size="small">+{record.mitre_techniques.length - 3}</Tag>}
                </Space>
              ),
            },
            {
              title: 'Matches (24h)',
              dataIndex: 'matches_24h',
              key: 'matches_24h',
              width: 120,
              align: 'center',
            },
            {
              title: 'FP Rate',
              dataIndex: 'false_positive_rate',
              key: 'false_positive_rate',
              width: 100,
              render: (r: number) => `${(r * 100).toFixed(1)}%`,
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 150,
              fixed: 'right',
              render: (_, record: DetectionRule) => (
                <Space>
                  <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedRule(record); setDetailModalVisible(true) }}>Voir</Button>
                  <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleTestRule(record)}>Tester</Button>
                  <Switch
                    checked={record.status === 'active'}
                    onChange={() => handleToggleStatus(record)}
                    size="small"
                  />
                  <Button type="link" size="small" icon={<CodeOutlined />} onClick={() => { setEditorRule(record); setEditorVisible(true) }}>Éditer</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Rule Modal */}
      <Modal
        title="Nouvelle Règle de Détection"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => ruleForm.validateFields().then(handleCreateRule).catch(() => {})}
        width={700}
        form={ruleForm}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item name="name" label="Nom" rules={[{ required: true }]}>
            <Input placeholder="Nom de la règle" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Description" />
          </Form.Item>
          <Form.Item name="severity" label="Sévérité" rules={[{ required: true }]}>
            <Select>
              <Option value="critical">Critique</Option>
              <Option value="high">Haute</Option>
              <Option value="medium">Moyenne</Option>
              <Option value="low">Faible</Option>
              <Option value="info">Informationnel</Option>
            </Select>
          </Form.Item>
          <Form.Item name="source" label="Source" rules={[{ required: true }]}>
            <Select>
              <Option value="sigma">Sigma</Option>
              <Option value="custom">Personnalisée</Option>
            </Select>
          </Form.Item>
          <Form.Item name="rule_type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Option value="threshold">Seuil</Option>
              <Option value="pattern">Pattern</Option>
              <Option value="correlation">Corrélation</Option>
              <Option value="behavioral">Comportemental</Option>
            </Select>
          </Form.Item>
          <Form.Item name="logic" label="Logique (Sigma YAML)" rules={[{ required: true }]}>
            <TextArea rows={15} placeholder="Logique de détection en YAML Sigma" style={{ fontFamily: 'monospace', width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Rule Detail Modal */}
      <Modal
        title="Détails de la Règle"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedRule(null) }}
        width={900}
        destroyOnClose
      >
        {selectedRule && <RuleDetail rule={selectedRule} />}
      </Modal>

      {/* Editor Modal */}
      <Modal
        title="Éditeur de Règle Sigma"
        open={editorVisible}
        onCancel={() => { setEditorVisible(false); setEditorRule(null) }}
        width={1000}
        footer={[
          <Button key="save" type="primary" onClick={() => console.log('Save rule')}>Sauvegarder</Button>,
        ]}
        destroyOnClose
      >
        {editorRule && <RuleEditor rule={editorRule} />}
      </Modal>
    </div>
  )
}

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <Card className="stat-card">
    <div className="stat-header">
      <div className="stat-icon" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
      <Title level={5} className="stat-title">{title}</Title>
    </div>
    <Typography.Text style={{ fontSize: 28, fontWeight: 700 }}>{value}</Typography.Text>
  </Card>
)

const RuleDetail: React.FC<{ rule: DetectionRule }> = ({ rule }) => (
  <div className="rule-detail">
    <div className="detail-header">
      <Space>
        {renderSeverity(rule.severity)}
        {renderStatus(rule.status)}
        {renderSource(rule.source)}
      </Space>
    </div>

    <Title level={4}>{rule.name}</Title>
    <Paragraph>{rule.description || 'Aucune description'}</Paragraph>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={6}><DetailField label="Type" value={rule.rule_type} /></Grid>
      <Grid item xs={6}><DetailField label="Source" value={rule.source} /></Grid>
      <Grid item xs={6}><DetailField label="Matches (24h)" value={rule.matches_24h.toString()} /></Grid>
      <Grid item xs={6}><DetailField label="Taux FP" value={`${(rule.false_positive_rate * 100).toFixed(1)}%`} /></Grid>
    </Grid>

    <Divider />

    <Title level={5}>MITRE ATT&CK</Title>
    <Space wrap>
      {rule.mitre_techniques.map(t => <Tag key={t} color="blue">{t}</Tag>)}
      {rule.mitre_tactics.map(t => <Tag key={t} color="purple">{t}</Tag>)}
    </Space>

    <Divider />

    <Title level={5}>Logique de Détection</Title>
    <TextArea rows={20} value={rule.logic} readOnly style={{ fontFamily: 'monospace', width: '100%' }} />
  </div>
)

const RuleEditor: React.FC<{ rule: DetectionRule }> = ({ rule }) => (
  <div className="rule-editor">
    <Alert message="Éditeur YAML Sigma - La validation se fait à la sauvegarde" type="info" showIcon />
    <Form layout="vertical">
      <Form.Item name="name" label="Nom" rules={[{ required: true }]}>
        <Input defaultValue={rule.name} />
      </Form.Item>
      <Form.Item name="logic" label="Logique Sigma (YAML)" rules={[{ required: true }]}>
        <TextArea rows={30} defaultValue={rule.logic} style={{ fontFamily: 'monospace', width: '100%' }} />
      </Form.Item>
    </Form>
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

export default Detection