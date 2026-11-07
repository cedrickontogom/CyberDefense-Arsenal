import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Dropdown, Menu,
  Modal, Form, Input, Select, DatePicker, Tabs, Typography,
  Spin, Empty, Avatar, Divider, List, Popconfirm, Tooltip
} from 'antd'
import {
  FileTextOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, UserOutlined, ClockCircleOutlined, WarningOutlined,
  CheckCircleOutlined, RightOutlined, LeftOutlined, MoreOutlined,
  SyncOutlined, DownloadOutlined, FilterOutlined, SearchOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { useAuth } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './Cases.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { Option } = Select
const { TextArea } = Input

interface Case {
  id: string
  title: string
  description: string
  severity: string
  status: string
  assignee: string
  assignee_detail: { email: string; full_name: string; avatar?: string } | null
  reporter: string
  reporter_detail: { email: string; full_name: string } | null
  alert_ids: string[]
  alerts_count: number
  mitre_techniques: string[]
  mitre_tactics: string[]
  tags: string[]
  sla_deadline: string
  created_at: string
  updated_at: string
  closed_at: string
  comments_count: number
  attachments_count: number
}

interface Comment {
  id: string
  case_id: string
  user: { email: string; full_name: string; avatar?: string }
  content: string
  is_internal: boolean
  created_at: string
}

const severityColors: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
  info: 'gray',
}

const statusColors: Record<string, string> = {
  open: 'blue',
  investigating: 'orange',
  pending: 'purple',
  resolved: 'green',
  closed: 'gray',
  false_positive: 'gray',
}

const Cases: React.FC = () => {
  const { user } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [sorter, setSorter] = useState({ field: 'created_at', order: 'descend' })
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [caseForm] = Form.useForm()
  const [activeTab, setActiveTab] = useState('details')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')

  const fetchCases = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        ordering: `${sorter.order === 'descend' ? '-' : ''}${sorter.field}`,
        ...filters,
      }
      const res = await api.get('/cases/cases/', { params })
      setCases(res.results || [])
      setPagination(prev => ({ ...prev, total: res.count || 0 }))
    } catch (error) {
      console.error('Failed to fetch cases:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCases()
  }, [pagination.current, pagination.pageSize, sorter, filters])

  const handleTableChange = (newPagination: any, newFilters: any, newSorter: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
    setFilters(newFilters)
    if (newSorter.field) setSorter({ field: newSorter.field, order: newSorter.order })
  }

  const handleRowClick = (record: Case) => {
    setSelectedCase(record)
    setDetailModalVisible(true)
    fetchComments(record.id)
  }

  const fetchComments = async (caseId: string) => {
    try {
      const res = await api.get(`/cases/cases/${caseId}/comments/`)
      setComments(res.results || [])
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    }
  }

  const handleCreateCase = async (values: any) => {
    try {
      await api.post('/cases/cases/', values)
      setCreateModalVisible(false)
      caseForm.resetFields()
      fetchCases()
    } catch (error) {
      console.error('Failed to create case:', error)
    }
  }

  const handleAddComment = async () => {
    if (!selectedCase || !newComment.trim()) return
    try {
      await api.post(`/cases/cases/${selectedCase.id}/comments/`, {
        content: newComment,
        is_internal: true,
      })
      setNewComment('')
      fetchComments(selectedCase.id)
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

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

  const getSLAStatus = (deadline: string) => {
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (diffHours < 0) return { status: 'breached', text: 'SLA dépassé', color: 'red' }
    if (diffHours < 4) return { status: 'critical', text: `${Math.round(diffHours)}h restantes`, color: 'red' }
    if (diffHours < 24) return { status: 'warning', text: `${Math.round(diffHours)}h restantes`, color: 'orange' }
    return { status: 'ok', text: `${Math.round(diffHours / 24)}j restantes`, color: 'green' }
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
      render: (text: string, record: Case) => (
        <span onClick={() => handleRowClick(record)} style={{ cursor: 'pointer' }}>
          {text}
          {record.tags.length > 0 && (
            <Space style={{ marginLeft: 8 }}>
              {record.tags.slice(0, 2).map(tag => (
                <Tag key={tag} color="geekblue" size="small">{tag}</Tag>
              ))}
            </Space>
          )}
        </span>
      ),
    },
    {
      title: 'Assigné',
      key: 'assignee',
      width: 150,
      render: (_, record: Case) => record.assignee_detail ? (
        <Space>
          <Avatar size={20} src={record.assignee_detail.avatar} icon={<UserOutlined />}>
            {record.assignee_detail.full_name.charAt(0)}
          </Avatar>
          <span>{record.assignee_detail.full_name}</span>
        </Space>
      ) : <span style={{ color: '#999' }}>Non assigné</span>,
    },
    {
      title: 'Alertes',
      dataIndex: 'alerts_count',
      key: 'alerts_count',
      width: 80,
      align: 'center',
      render: (count: number) => (
        <Badge count={count} color={count > 0 ? 'red' : 'default'} />
      ),
    },
    {
      title: 'SLA',
      key: 'sla',
      width: 150,
      render: (_, record: Case) => {
        const sla = getSLAStatus(record.sla_deadline)
        return (
          <Tag color={sla.color}>{sla.text}</Tag>
        )
      },
    },
    {
      title: 'Créé le',
      dataIndex: 'created_at',
      key: 'created_at',
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
      render: (_, record: Case) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', label: 'Voir détails', icon: <EyeOutlined />, onClick: () => handleRowClick(record) },
              { key: 'edit', label: 'Modifier', icon: <EditOutlined /> },
              { type: 'divider' as const },
              { key: 'assign', label: 'Assigner', icon: <UserOutlined /> },
              { key: 'close', label: 'Clôturer', icon: <CheckCircleOutlined />, danger: true },
            ]
          }}
          placement="bottomRight"
        >
          <Button type="link" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ]

  return (
    <div className="cases-page">
      <div className="page-header">
        <div>
          <Title level={2}>Cas & Investigations</Title>
          <Text type="secondary">Gestion des incidents de sécurité</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} type="default">Exporter</Button>
          <Button icon={<SyncOutlined />} onClick={fetchCases} loading={loading}>Actualiser</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalVisible(true)}>
            Nouveau Cas
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          pagination={pagination}
          sorter={sorter}
          filters={filters}
          onChange={handleTableChange}
          loading={loading}
          rowClassName={(record: Case) => `severity-${record.severity}`}
          onRow={(record: Case) => ({ onClick: () => handleRowClick(record) })}
          expandedRowRender={(record: Case) => (
            <div className="expanded-row">
              <Space wrap>
                <div><strong>Description:</strong> {record.description || 'Aucune description'}</div>
                <div><strong>MITRE:</strong> {record.mitre_techniques.join(', ') || 'Aucun'}</div>
                <div><strong>Commentaires:</strong> {record.comments_count} • <strong>Pièces jointes:</strong> {record.attachments_count}</div>
              </Space>
            </div>
          )}
        />
      </Card>

      {/* Create Case Modal */}
      <Modal
        title="Nouveau Cas"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => caseForm.validateFields().then(handleCreateCase).catch(() => {})}
        width={600}
        form={caseForm}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item name="title" label="Titre" rules={[{ required: true }]}>
            <Input placeholder="Titre du cas" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Description détaillée" />
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
          <Form.Item name="assignee" label="Assigner à">
            <Select placeholder="Sélectionner" showSearch />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Ajouter des tags" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Détails du Cas"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedCase(null) }}
        width={900}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>Fermer</Button>,
        ]}
        destroyOnClose
      >
        {selectedCase && (
          <Tabs activeKey={activeTab} onChange={setActiveTab} className="case-detail-tabs">
            <TabPane tab="Détails" key="details">
              <CaseDetail case={selectedCase} />
            </TabPane>
            <TabPane tab={`Commentaires (${selectedCase.comments_count})`} key="comments">
              <CaseComments
                comments={comments}
                newComment={newComment}
                onNewCommentChange={setNewComment}
                onAddComment={handleAddComment}
              />
            </TabPane>
            <TabPane tab="Chronologie" key="timeline">
              <CaseTimeline caseId={selectedCase.id} />
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  )
}

const CaseDetail: React.FC<{ case: Case }> = ({ case: caseData }) => (
  <div className="case-detail">
    <div className="detail-header">
      <Space>
        <Tag color={severityColors[caseData.severity] || 'default'} size="large">
          {caseData.severity.toUpperCase()}
        </Tag>
        <Tag color={statusColors[caseData.status] || 'default'} size="large">
          {caseData.status.replace('_', ' ')}
        </Tag>
      </Space>
    </div>

    <Title level={4}>{caseData.title}</Title>
    <Paragraph>{caseData.description || 'Aucune description'}</Paragraph>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={12} sm={6}>
        <DetailField label="ID Cas" value={caseData.id} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Signaleur" value={caseData.reporter_detail?.full_name || 'N/A'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Assigné" value={caseData.assignee_detail?.full_name || 'Non assigné'} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Alertes liées" value={`${caseData.alerts_count} alerte(s)`} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="SLA Deadline" value={new Date(caseData.sla_deadline).toLocaleString('fr-FR')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Créé le" value={new Date(caseData.created_at).toLocaleString('fr-FR')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Mis à jour" value={new Date(caseData.updated_at).toLocaleString('fr-FR')} />
      </Grid>
      <Grid item xs={12} sm={6}>
        <DetailField label="Tags" value={caseData.tags.join(', ') || 'Aucun'} />
      </Grid>
    </Grid>

    {caseData.mitre_techniques.length > 0 && (
      <Divider />
      <Title level={5}>MITRE ATT&CK</Title>
      <Space wrap>
        {caseData.mitre_techniques.map(t => <Tag key={t} color="blue">{t}</Tag>)}
        {caseData.mitre_tactics.map(t => <Tag key={t} color="purple">{t}</Tag>)}
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

const CaseComments: React.FC<{
  comments: Comment[]
  newComment: string
  onNewCommentChange: (value: string) => void
  onAddComment: () => void
}> = ({ comments, newComment, onNewCommentChange, onAddComment }) => (
  <div className="case-comments">
    <List
      dataSource={comments}
      renderItem={comment => (
        <List.Item
          actions={comment.is_internal ? [<Tag color="blue">Interne</Tag>] : []}
        >
          <List.Item.Meta
            avatar={<Avatar src={comment.user.avatar} icon={<UserOutlined />}>{comment.user.full_name.charAt(0)}</Avatar>
            title={comment.user.full_name}
            description={<span style={{ color: '#999' }}>{new Date(comment.created_at).toLocaleString('fr-FR')}</span>}
          />
          <Typography.Text>{comment.content}</Typography.Text>
        </List.Item>
      )}
    />
    <Divider />
    <Space direction="vertical" style={{ width: '100%' }}>
      <TextArea
        value={newComment}
        onChange={e => onNewCommentChange(e.target.value)}
        rows={3}
        placeholder="Ajouter un commentaire interne..."
      />
      <Button type="primary" onClick={onAddComment} icon={<RightOutlined />}>
        Ajouter commentaire
      </Button>
    </Space>
  </div>
)

const CaseTimeline: React.FC<{ caseId: string }> = ({ caseId }) => (
  <div className="case-timeline">
    <Typography.Text type="secondary">Chronologie à implémenter</Typography.Text>
  </div>
)

export default Cases