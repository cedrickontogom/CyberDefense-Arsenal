import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Modal, Form,
  Input, Select, Tabs, Typography, Spin, Tooltip, Popconfirm,
  Dropdown, Menu, List, Avatar, Divider, Switch, Alert
} from 'antd'
import {
  PlayCircleOutlined, PauseCircleOutlined, StopOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined,
  SyncOutlined, DownloadOutlined, PlusOutlined, SettingOutlined,
  FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, RightOutlined, LeftOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './Playbooks.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { TextArea } = Input

interface Playbook {
  id: string
  name: string
  description: string
  trigger: string
  status: string
  version: string
  runs_count: number
  last_run: string
  success_rate: number
  created_by: string
  created_at: string
  updated_at: string
  steps: PlaybookStep[]
}

interface PlaybookStep {
  id: string
  name: string
  type: string
  config: Record<string, any>
  order: number
  condition?: string
}

interface PlaybookRun {
  id: string
  playbook_id: string
  playbook_name: string
  status: string
  started_at: string
  completed_at: string
  duration: number
  steps_completed: number
  steps_total: number
  error?: string
}

const Playbooks: React.FC = () => {
  const [activeTab, setActiveTab] = useState('library')
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [runs, setRuns] = useState<PlaybookRun[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [runPagination, setRunPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [runDetailModalVisible, setRunDetailModalVisible] = useState(false)
  const [selectedRun, setSelectedRun] = useState<PlaybookRun | null>(null)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [playbookForm] = Form.useForm()
  const [editorPlaybook, setEditorPlaybook] = useState<Playbook | null>(null)
  const [editorVisible, setEditorVisible] = useState(false)

  const fetchPlaybooks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/playbooks/playbooks/', {
        params: { page: pagination.current, page_size: pagination.pageSize }
      })
      setPlaybooks(res.results || [])
      setPagination(prev => ({ ...prev, total: res.count || 0 }))
    } catch (error) {
      console.error('Failed to fetch playbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRuns = async () => {
    try {
      const res = await api.get('/playbooks/runs/', {
        params: { page: runPagination.current, page_size: runPagination.pageSize }
      })
      setRuns(res.results || [])
      setRunPagination(prev => ({ ...prev, total: res.count || 0 }))
    } catch (error) {
      console.error('Failed to fetch runs:', error)
    }
  }

  useEffect(() => {
    fetchPlaybooks()
    fetchRuns()
  }, [pagination.current, runPagination.current])

  const handleTableChange = (newPagination: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
  }

  const handleRunTableChange = (newPagination: any) => {
    setRunPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
  }

  const handleCreatePlaybook = async (values: any) => {
    try {
      await api.post('/playbooks/playbooks/', values)
      setCreateModalVisible(false)
      playbookForm.resetFields()
      fetchPlaybooks()
    } catch (error) {
      console.error('Failed to create playbook:', error)
    }
  }

  const handleExecutePlaybook = async (playbook: Playbook) => {
    try {
      await api.post(`/playbooks/playbooks/${playbook.id}/execute/`)
      fetchRuns()
    } catch (error) {
      console.error('Failed to execute playbook:', error)
    }
  }

  const handleViewRun = (run: PlaybookRun) => {
    setSelectedRun(run)
    setRunDetailModalVisible(true)
  }

  const renderStatus = (status: string) => {
    const colors: Record<string, string> = {
      active: 'green',
      inactive: 'gray',
      draft: 'blue',
      running: 'blue',
      completed: 'green',
      failed: 'red',
      cancelled: 'orange',
    }
    return <Tag color={colors[status] || 'default'}>{status}</Tag>
  }

  return (
    <div className="playbooks-page">
      <div className="page-header">
        <div>
          <Title level={2}>Playbooks d'Automatisation</Title>
          <Text type="secondary">Orchestration de la réponse aux incidents</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={() => { fetchPlaybooks(); fetchRuns() }} loading={loading}>Actualiser</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setCreateModalVisible(true)}>
            Nouveau Playbook
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="playbooks-tabs">
        <TabPane tab="Bibliothèque" key="library">
          <Card>
            <Table
              dataSource={playbooks}
              rowKey="id"
              pagination={pagination}
              loading={loading}
              onChange={handleTableChange}
              columns={[
                { title: 'Nom', dataIndex: 'name', key: 'name', width: 200, render: (n: string) => <strong>{n}</strong> },
                { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
                { title: 'Déclencheur', dataIndex: 'trigger', key: 'trigger', width: 150 },
                { title: 'Statut', dataIndex: 'status', key: 'status', width: 100, render: renderStatus },
                { title: 'Version', dataIndex: 'version', key: 'version', width: 80 },
                { title: 'Exécutions', dataIndex: 'runs_count', key: 'runs_count', width: 100, align: 'center' },
                { title: 'Taux succès', dataIndex: 'success_rate', key: 'success_rate', width: 100, render: (r: number) => `${(r * 100).toFixed(1)}%` },
                { title: 'Dernière exécution', dataIndex: 'last_run', key: 'last_run', width: 160, render: (d: string) => d ? new Date(d).toLocaleString('fr-FR') : 'Jamais' },
                {
                  title: 'Actions',
                  key: 'actions',
                  width: 120,
                  fixed: 'right',
                  render: (_, record: Playbook) => (
                    <Space>
                      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedPlaybook(record); setDetailModalVisible(true) }}>Voir</Button>
                      <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecutePlaybook(record)}>Exécuter</Button>
                      <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => { setEditorPlaybook(record); setEditorVisible(true) }}>Éditer</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>

        <TabPane tab="Exécutions" key="runs">
          <Card>
            <Table
              dataSource={runs}
              rowKey="id"
              pagination={runPagination}
              loading={false}
              onChange={handleRunTableChange}
              columns={[
                { title: 'Playbook', dataIndex: 'playbook_name', key: 'playbook_name', width: 200 },
                { title: 'Statut', dataIndex: 'status', key: 'status', width: 100, render: renderStatus },
                { title: 'Début', dataIndex: 'started_at', key: 'started_at', width: 160, render: (d: string) => new Date(d).toLocaleString('fr-FR') },
                { title: 'Fin', dataIndex: 'completed_at', key: 'completed_at', width: 160, render: (d: string) => d ? new Date(d).toLocaleString('fr-FR') : 'En cours' },
                { title: 'Durée', dataIndex: 'duration', key: 'duration', width: 100, render: (d: number) => `${(d / 1000).toFixed(1)}s` },
                { title: 'Progression', dataIndex: 'steps_completed', key: 'progress', width: 120, render: (c: number, r: PlaybookRun) => `${c}/${r.steps_total}` },
                {
                  title: 'Actions',
                  key: 'actions',
                  width: 100,
                  render: (_, record: PlaybookRun) => (
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewRun(record)}>Détails</Button>
                  ),
                },
              ]}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Create Playbook Modal */}
      <Modal
        title="Nouveau Playbook"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => playbookForm.validateFields().then(handleCreatePlaybook).catch(() => {})}
        width={600}
        form={playbookForm}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item name="name" label="Nom" rules={[{ required: true }]}>
            <Input placeholder="Nom du playbook" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Description" />
          </Form.Item>
          <Form.Item name="trigger" label="Type de déclencheur" rules={[{ required: true }]}>
            <Select>
              <Option value="alert_created">Alerte créée</Option>
              <Option value="case_created">Cas créé</Option>
              <Option value="scheduled">Planifié</Option>
              <Option value="manual">Manuel</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Playbook Detail Modal */}
      <Modal
        title="Détails du Playbook"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedPlaybook(null) }}
        width={800}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>Fermer</Button>,
        ]}
        destroyOnClose
      >
        {selectedPlaybook && <PlaybookDetail playbook={selectedPlaybook} onExecute={handleExecutePlaybook} />}
      </Modal>

      {/* Run Detail Modal */}
      <Modal
        title="Détails de l'Exécution"
        open={runDetailModalVisible}
        onCancel={() => { setRunDetailModalVisible(false); setSelectedRun(null) }}
        width={800}
        destroyOnClose
      >
        {selectedRun && <RunDetail run={selectedRun} />}
      </Modal>

      {/* Editor Modal */}
      <Modal
        title="Éditeur de Playbook"
        open={editorVisible}
        onCancel={() => { setEditorVisible(false); setEditorPlaybook(null) }}
        width={1000}
        footer={[
          <Button key="save" type="primary" onClick={() => console.log('Save playbook')}>Sauvegarder</Button>,
        ]}
        destroyOnClose
      >
        {editorPlaybook && <PlaybookEditor playbook={editorPlaybook} />}
      </Modal>
    </div>
  )
}

const PlaybookDetail: React.FC<{ playbook: Playbook; onExecute: (p: Playbook) => void }> = ({ playbook, onExecute }) => (
  <div className="playbook-detail">
    <div className="detail-header">
      <Space>
        <Tag color={playbook.status === 'active' ? 'green' : playbook.status === 'draft' ? 'blue' : 'gray'} size="large">{playbook.status}</Tag>
        <Tag color="blue" size="large">v{playbook.version}</Tag>
      </Space>
    </div>

    <Title level={4}>{playbook.name}</Title>
    <Paragraph>{playbook.description || 'Aucune description'}</Paragraph>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={6}><DetailField label="Déclencheur" value={playbook.trigger} /></Grid>
      <Grid item xs={6}><DetailField label="Exécutions" value={playbook.runs_count.toString()} /></Grid>
      <Grid item xs={6}><DetailField label="Taux succès" value={`${(playbook.success_rate * 100).toFixed(1)}%`} /></Grid>
      <Grid item xs={6}><DetailField label="Dernière exécution" value={playbook.last_run ? new Date(playbook.last_run).toLocaleString('fr-FR') : 'Jamais'} /></Grid>
    </Grid>

    <Divider />

    <Title level={5}>Étapes ({playbook.steps.length})</Title>
    <List
      dataSource={playbook.steps}
      renderItem={step => (
        <List.Item>
          <Space>
            <Tag color="blue">{step.order}</Tag>
            <strong>{step.name}</strong>
            <Tag color="gray">{step.type}</Tag>
            {step.condition && <Tag color="orange">Condition: {step.condition}</Tag>}
          </Space>
        </List.Item>
      )}
    />
  </div>
)

const RunDetail: React.FC<{ run: PlaybookRun }> = ({ run }) => (
  <div className="run-detail">
    <div className="detail-header">
      <Tag color={run.status === 'running' ? 'blue' : run.status === 'completed' ? 'green' : run.status === 'failed' ? 'red' : 'orange'} size="large">{run.status}</Tag>
    </div>

    <Title level={4}>{run.playbook_name}</Title>

    <Divider />

    <Grid container spacing={16}>
      <Grid item xs={6}><DetailField label="Début" value={new Date(run.started_at).toLocaleString('fr-FR')} /></Grid>
      <Grid item xs={6}><DetailField label="Fin" value={run.completed_at ? new Date(run.completed_at).toLocaleString('fr-FR') : 'En cours'} /></Grid>
      <Grid item xs={6}><DetailField label="Durée" value={`${(run.duration / 1000).toFixed(1)}s`} /></Grid>
      <Grid item xs={6}><DetailField label="Progression" value={`${run.steps_completed}/${run.steps_total}`} /></Grid>
    </Grid>

    {run.error && (
      <>
        <Divider />
        <Alert message="Erreur" description={run.error} type="error" showIcon />
      </>
    )}
  </div>
)

const PlaybookEditor: React.FC<{ playbook: Playbook }> = ({ playbook }) => (
  <div className="playbook-editor">
    <Alert message="Éditeur visuel à implémenter - Utilisez le format YAML pour l'instant" type="info" showIcon />
    <TextArea rows={30} defaultValue={JSON.stringify(playbook, null, 2)} style={{ fontFamily: 'monospace', width: '100%' }} />
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

export default Playbooks