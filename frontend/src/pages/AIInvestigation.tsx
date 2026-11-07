import React, { useEffect, useState } from 'react'
import {
  Card, Button, Tag, Badge, Space, Tabs, Typography,
  Spin, List, Avatar, Divider, Input, Modal, Form,
  Tooltip, Popover, Select, Alert, Timeline
} from 'antd'
import {
  RobotOutlined, SyncOutlined, PlayCircleOutlined, PauseCircleOutlined,
  StopOutlined, FileTextOutlined, SearchOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  InfoCircleOutlined, WarningOutlined, HistoryOutlined, BoltOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './AIInvestigation.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { TextArea } = Input

interface Investigation {
  id: string
  case_id: string
  case_title: string
  status: string
  verdict: string
  confidence: number
  severity: string
  summary: string
  reasoning: string
  evidence: any[]
  recommendations: string[]
  tokens_used: number
  cost_usd: number
  model_used: string
  created_at: string
  completed_at: string
}

interface Case {
  id: string
  title: string
  severity: string
  status: string
}

const AIInvestigation: React.FC = () => {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState<string>('')
  const [investigationModalVisible, setInvestigationModalVisible] = useState(false)
  const [investigationForm] = Form.useForm()
  const [runningInvestigation, setRunningInvestigation] = useState<string | null>(null)

  const fetchInvestigations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/ai/investigations/')
      setInvestigations(res.results || [])
    } catch (error) {
      console.error('Failed to fetch investigations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCases = async () => {
    try {
      const res = await api.get('/cases/cases/', { params: { status: 'open,investigating', page_size: 100 } })
      setCases(res.results || [])
    } catch (error) {
      console.error('Failed to fetch cases:', error)
    }
  }

  useEffect(() => {
    fetchInvestigations()
    fetchCases()
  }, [])

  const handleStartInvestigation = async (values: any) => {
    setRunningInvestigation(values.case_id)
    try {
      await api.post('/ai/investigate/', { case_id: values.case_id })
      setInvestigationModalVisible(false)
      fetchInvestigations()
    } catch (error) {
      console.error('Failed to start investigation:', error)
    } finally {
      setRunningInvestigation(null)
    }
  }

  const handleViewInvestigation = (inv: Investigation) => {
    setSelectedInvestigation(inv)
    setDetailModalVisible(true)
  }

  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  const verdictColors: Record<string, string> = {
    malicious: 'red',
    suspicious: 'orange',
    benign: 'green',
    unknown: 'gray',
  }

  const verdictIcons: Record<string, React.ReactNode> = {
    malicious: <ExclamationCircleOutlined />,
    suspicious: <WarningOutlined />,
    benign: <CheckCircleOutlined />,
    unknown: <InfoCircleOutlined />,
  }

  return (
    <div className="ai-investigation-page">
      <div className="page-header">
        <div>
          <Title level={2}>Investigation IA</Title>
          <Text type="secondary">Analyse automatisée des cas par agents IA</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchInvestigations} loading={loading}>Actualiser</Button>
          <Button icon={<PlayCircleOutlined />} type="primary" onClick={() => setInvestigationModalVisible(true)}>
            Nouvelle Investigation
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} className="stats-row" style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Total Investigations" value={investigations.length} icon={<RobotOutlined />} color="blue" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="En cours" value={investigations.filter(i => i.status === 'running').length} icon={<PlayCircleOutlined />} color="orange" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Terminées" value={investigations.filter(i => i.status === 'completed').length} icon={<CheckCircleOutlined />} color="green" />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard title="Coût total" value={`$${investigations.reduce((sum, i) => sum + i.cost_usd, 0).toFixed(4)}`} icon={<DollarCircleOutlined />} color="purple" />
        </Col>
      </Row>

      {/* Investigations List */}
      <Card>
        <List
          dataSource={investigations}
          renderItem={inv => (
            <List.Item className="investigation-item" actions={[
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewInvestigation(inv)}>Voir</Button>,
            ]}>
              <List.Item.Meta
                avatar={
                  <div className={`investigation-avatar ${inv.status}`}>
                    {verdictIcons[inv.verdict] || <RobotOutlined />}
                  </div>
                }
                title={
                  <Space>
                    <Title level={5}>{inv.case_title}</Title>
                    <Tag color={verdictColors[inv.verdict] || 'default'}>{inv.verdict}</Tag>
                    <Tag color={inv.status === 'running' ? 'blue' : inv.status === 'completed' ? 'green' : 'orange'}>{inv.status}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">{inv.summary}</Text>
                    <Space>
                      <Tag color="blue">{inv.model_used}</Tag>
                      <Text type="secondary">Confiance: {(inv.confidence * 100).toFixed(0)}%</Text>
                      <Text type="secondary">Tokens: {inv.tokens_used} • Coût: ${inv.cost_usd.toFixed(6)}</Text>
                      <Text type="secondary">{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true, locale: fr })}</Text>
                    </Space>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* Start Investigation Modal */}
      <Modal
        title="Lancer une Investigation"
        open={investigationModalVisible}
        onCancel={() => setInvestigationModalVisible(false)}
        onOk={() => investigationForm.validateFields().then(handleStartInvestigation).catch(() => {})}
        width={500}
        form={investigationForm}
        destroyOnClose
      >
        <Form layout="vertical">
          <Alert message="L'IA analysera le cas, les alertes associées, les IOCs et le contexte pour produire un verdict, un niveau de confiance et des recommandations." type="info" showIcon />
          <Form.Item name="case_id" label="Cas à investiguer" rules={[{ required: true }]}>
            <Select
              placeholder="Sélectionner un cas"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => (option?.children as string)?.toLowerCase().includes(input.toLowerCase())}
            >
              {cases.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.title} ({c.severity})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Détails de l'Investigation"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedInvestigation(null) }}
        width={900}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>Fermer</Button>,
        ]}
        destroyOnClose
      >
        {selectedInvestigation && <InvestigationDetail investigation={selectedInvestigation} />}
      </Modal>
    </div>
  )
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <Card className="stat-card">
    <div className="stat-header">
      <div className="stat-icon" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
      <Title level={5} className="stat-title">{title}</Title>
    </div>
    <Typography.Text style={{ fontSize: 28, fontWeight: 700 }}>{value}</Typography.Text>
  </Card>
)

const InvestigationDetail: React.FC<{ investigation: Investigation }> = ({ investigation }) => (
  <div className="investigation-detail">
    <div className="detail-header">
      <Space>
        <Tag color={investigation.verdict === 'malicious' ? 'red' : investigation.verdict === 'suspicious' ? 'orange' : investigation.verdict === 'benign' ? 'green' : 'gray'} size="large">
          {investigation.verdict.toUpperCase()}
        </Tag>
        <Tag color={investigation.status === 'running' ? 'blue' : investigation.status === 'completed' ? 'green' : 'orange'} size="large">
          {investigation.status}
        </Tag>
      </Space>
    </div>

    <div className="verdict-summary">
      <Typography.Title level={4}>Verdict: {investigation.verdict}</Typography.Title>
      <ProgressBar percent={investigation.confidence} color={investigation.verdict === 'malicious' ? 'red' : investigation.verdict === 'suspicious' ? 'orange' : 'green'} />
      <Text type="secondary">Confiance: {(investigation.confidence * 100).toFixed(0)}%</Text>
    </div>

    <Divider />

    <Typography.Title level={5}>Résumé</Typography.Title>
    <Paragraph>{investigation.summary}</Paragraph>

    <Divider />

    <Typography.Title level={5}>Raisonnement</Typography.Title>
    <Paragraph>{investigation.reasoning}</Paragraph>

    <Divider />

    <Typography.Title level={5}>Preuves</Typography.Title>
    <Space wrap>
      {investigation.evidence.map((e, i) => (
        <Tag key={i} color="blue">{JSON.stringify(e)}</Tag>
      ))}
    </Space>

    <Divider />

    <Typography.Title level={5}>Recommandations</Typography.Title>
    <Space direction="vertical" style={{ width: '100%' }}>
      {investigation.recommendations.map((r, i) => (
        <Alert key={i} message={r} type="info" showIcon />
      ))}
    </Space>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={6}><DetailField label="Modèle" value={investigation.model_used} /></Grid>
      <Grid item xs={6}><DetailField label="Tokens utilisés" value={investigation.tokens_used.toString()} /></Grid>
      <Grid item xs={6}><DetailField label="Coût" value={`$${investigation.cost_usd.toFixed(6)}`} /></Grid>
      <Grid item xs={6}><DetailField label="Créé le" value={new Date(investigation.created_at).toLocaleString('fr-FR')} /></Grid>
      {investigation.completed_at && <Grid item xs={6}><DetailField label="Terminé le" value={new Date(investigation.completed_at).toLocaleString('fr-FR')}</Grid>}
    </Grid>
  </div>
)

const ProgressBar: React.FC<{ percent: number; color: string }> = ({ percent, color }) => (
  <div className="progress-bar" style={{ width: '100%', height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ width: `${percent * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

export default AIInvestigation