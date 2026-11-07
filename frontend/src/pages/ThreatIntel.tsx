import React, { useEffect, useState } from 'react'
import {
  Card, Table, Button, Tag, Badge, Space, Input, Select,
  Modal, Form, Tabs, Typography, Spin, Tooltip, Popover,
  DatePicker, Dropdown, Menu, Avatar, List, Divider
} from 'antd'
import {
  SafetyOutlined, SearchOutlined, SyncOutlined, DownloadOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, WarningOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  GlobalOutlined, DatabaseOutlined, KeyOutlined, LockOutlined
} from '@ant-design/icons'
import { api } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import './ThreatIntel.scss'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs
const { Option } = Select
const { TextArea } = Input

interface CVE {
  id: string
  cve_id: string
  description: string
  severity: string
  cvss_score: number
  published_date: string
  last_modified: string
  references: string[]
  affected_products: string[]
  mitre_techniques: string[]
  kev_listed: boolean
  epss_score: number
}

interface ThreatActor {
  id: string
  name: string
  aliases: string[]
  description: string
  country: string
  motivation: string
  sophistication: string
  first_seen: string
  last_seen: string
  mitre_techniques: string[]
}

interface IOC {
  id: string
  type: string
  value: string
  description: string
  source: string
  confidence: number
  tags: string[]
  first_seen: string
  last_seen: string
  related_cves: string[]
  related_actors: string[]
}

const ThreatIntel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('cves')
  const [cves, setCVEs] = useState<CVE[]>([])
  const [actors, setActors] = useState<ThreatActor[]>([])
  const [iocs, setIOCs] = useState<IOC[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'cves') {
        const res = await api.get('/threatintel/cves/', {
          params: { page: pagination.current, page_size: pagination.pageSize, ...filters }
        })
        setCVEs(res.results || [])
        setPagination(prev => ({ ...prev, total: res.count || 0 }))
      } else if (activeTab === 'actors') {
        const res = await api.get('/threatintel/actors/', {
          params: { page: pagination.current, page_size: pagination.pageSize, ...filters }
        })
        setActors(res.results || [])
        setPagination(prev => ({ ...prev, total: res.count || 0 }))
      } else {
        const res = await api.get('/threatintel/iocs/', {
          params: { page: pagination.current, page_size: pagination.pageSize, ...filters }
        })
        setIOCs(res.results || [])
        setPagination(prev => ({ ...prev, total: res.count || 0 }))
      }
    } catch (error) {
      console.error('Failed to fetch threat intel:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab, pagination.current, pagination.pageSize, filters])

  const handleTableChange = (newPagination: any, newFilters: any) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }))
    setFilters(newFilters)
  }

  const severityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'red', high: 'orange', medium: 'gold', low: 'blue', info: 'gray'
    }
    return colors[severity] || 'default'
  }

  return (
    <div className="threatintel-page">
      <div className="page-header">
        <div>
          <Title level={2}>Threat Intelligence</Title>
          <Text type="secondary">CVE, Acteurs de menace, IOCs et feeds de renseignement</Text>
        </div>
        <Space>
          <Button icon={<SyncOutlined />} onClick={fetchData} loading={loading}>Actualiser</Button>
          <Button icon={<DownloadOutlined />}>Exporter</Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="intel-tabs">
        <TabPane tab="CVE & Vulnérabilités" key="cves">
          <CVEList
            cves={cves}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onView={item => { setSelectedItem(item); setDetailModalVisible(true) }}
          />
        </TabPane>
        <TabPane tab="Acteurs de Menace" key="actors">
          <ActorList
            actors={actors}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onView={item => { setSelectedItem(item); setDetailModalVisible(true) }}
          />
        </TabPane>
        <TabPane tab="Indicateurs (IOCs)" key="iocs">
          <IOCList
            iocs={iocs}
            loading={loading}
            pagination={pagination}
            onTableChange={handleTableChange}
            onView={item => { setSelectedItem(item); setDetailModalVisible(true) }}
          />
        </TabPane>
      </Tabs>

      <Modal
        title="Détails"
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedItem(null) }}
        width={800}
        destroyOnClose
      >
        {selectedItem && (
          <ThreatIntelDetail item={selectedItem} type={activeTab} />
        )}
      </Modal>
    </div>
  )
}

const CVEList: React.FC<{
  cves: CVE[]
  loading: boolean
  pagination: any
  onTableChange: (pagination: any, filters: any) => void
  onView: (item: CVE) => void
}> = ({ cves, loading, pagination, onTableChange, onView }) => (
  <Card>
    <Table
      dataSource={cves}
      rowKey="id"
      pagination={pagination}
      loading={loading}
      onChange={onTableChange}
      rowSelection={{ columnWidth: 40 }}
      onRow={(record: CVE) => ({ onClick: () => onView(record) })}
      columns={[
        {
          title: 'CVE',
          dataIndex: 'cve_id',
          key: 'cve_id',
          width: 150,
          render: (id: string) => <strong>{id}</strong>,
        },
        {
          title: 'Sévérité',
          dataIndex: 'severity',
          key: 'severity',
          width: 100,
          render: (s: string) => <Tag color={severityColor(s)}>{s.toUpperCase()}</Tag>,
        },
        {
          title: 'CVSS',
          dataIndex: 'cvss_score',
          key: 'cvss_score',
          width: 80,
          render: (score: number) => (
            <Tag color={score >= 9 ? 'red' : score >= 7 ? 'orange' : score >= 4 ? 'gold' : 'blue'}>
              {score.toFixed(1)}
            </Tag>
          ),
        },
        {
          title: 'KEV',
          dataIndex: 'kev_listed',
          key: 'kev_listed',
          width: 80,
          render: (kev: boolean) => kev ? (
            <Tag color="red"><WarningOutlined /> CISA KEV</Tag>
          ) : null,
        },
        {
          title: 'EPSS',
          dataIndex: 'epss_score',
          key: 'epss_score',
          width: 80,
          render: (score: number) => (
            <Tag color={score > 0.5 ? 'red' : score > 0.1 ? 'orange' : 'blue'}>
              {(score * 100).toFixed(1)}%
            </Tag>
          ),
        },
        {
          title: 'Description',
          dataIndex: 'description',
          key: 'description',
          ellipsis: true,
        },
        {
          title: 'Publié',
          dataIndex: 'published_date',
          key: 'published_date',
          width: 150,
          render: (date: string) => new Date(date).toLocaleDateString('fr-FR'),
        },
      ]}
    />
  </Card>
)

const ActorList: React.FC<{
  actors: ThreatActor[]
  loading: boolean
  pagination: any
  onTableChange: (pagination: any, filters: any) => void
  onView: (item: ThreatActor) => void
}> = ({ actors, loading, pagination, onTableChange, onView }) => (
  <Card>
    <Table
      dataSource={actors}
      rowKey="id"
      pagination={pagination}
      loading={loading}
      onChange={onTableChange}
      onRow={(record: ThreatActor) => ({ onClick: () => onView(record) })}
      columns={[
        { title: 'Nom', dataIndex: 'name', key: 'name', width: 200, render: (n: string) => <strong>{n}</strong> },
        { title: 'Aliases', dataIndex: 'aliases', key: 'aliases', render: (a: string[]) => a.join(', ') },
        { title: 'Pays', dataIndex: 'country', key: 'country', width: 100 },
        { title: 'Motivation', dataIndex: 'motivation', key: 'motivation', width: 120 },
        { title: 'Sophistication', dataIndex: 'sophistication', key: 'sophistication', width: 120 },
        { title: 'First Seen', dataIndex: 'first_seen', key: 'first_seen', width: 150, render: (d: string) => new Date(d).toLocaleDateString('fr-FR') },
        { title: 'Last Seen', dataIndex: 'last_seen', key: 'last_seen', width: 150, render: (d: string) => new Date(d).toLocaleDateString('fr-FR') },
      ]}
    />
  </Card>
)

const IOCList: React.FC<{
  iocs: IOC[]
  loading: boolean
  pagination: any
  onTableChange: (pagination: any, filters: any) => void
  onView: (item: IOC) => void
}> = ({ iocs, loading, pagination, onTableChange, onView }) => (
  <Card>
    <Table
      dataSource={iocs}
      rowKey="id"
      pagination={pagination}
      loading={loading}
      onChange={onTableChange}
      onRow={(record: IOC) => ({ onClick: () => onView(record) })}
      columns={[
        {
          title: 'Type',
          dataIndex: 'type',
          key: 'type',
          width: 120,
          render: (t: string) => <Tag color="blue">{t.toUpperCase()}</Tag>,
        },
        { title: 'Valeur', dataIndex: 'value', key: 'value', ellipsis: true },
        {
          title: 'Confiance',
          dataIndex: 'confidence',
          key: 'confidence',
          width: 100,
          render: (c: number) => <Tag color={c > 80 ? 'green' : c > 50 ? 'gold' : 'red'}>{c}%</Tag>,
        },
        { title: 'Source', dataIndex: 'source', key: 'source', width: 150 },
        { title: 'Tags', dataIndex: 'tags', key: 'tags', render: (t: string[]) => <Space wrap>{t.map(tag => <Tag key={tag} size="small">{tag}</Tag>)}</Space> },
        { title: 'First Seen', dataIndex: 'first_seen', key: 'first_seen', width: 150, render: (d: string) => new Date(d).toLocaleDateString('fr-FR') },
      ]}
    />
  </Card>
)

const severityColor = (severity: string) => {
  const colors: Record<string, string> = { critical: 'red', high: 'orange', medium: 'gold', low: 'blue', info: 'gray' }
  return colors[severity] || 'default'
}

const ThreatIntelDetail: React.FC<{ item: any; type: string }> = ({ item, type }) => (
  <div className="threat-detail">
    {type === 'cves' && (
      <>
        <div className="detail-header">
          <Tag color={severityColor(item.severity)} size="large">{item.severity.toUpperCase()}</Tag>
          {item.kev_listed && <Tag color="red" size="large"><WarningOutlined /> CISA KEV</Tag>}
        </div>
        <Title level={4}>{item.cve_id}</Title>
        <Paragraph>{item.description}</Paragraph>
        <Divider />
        <Grid container spacing={16}>
          <Grid item xs={6}><DetailField label="CVSS Score" value={item.cvss_score.toFixed(1)} /></Grid>
          <Grid item xs={6}><DetailField label="EPSS Score" value={`${(item.epss_score * 100).toFixed(1)}%`} /></Grid>
          <Grid item xs={6}><DetailField label="Publié" value={new Date(item.published_date).toLocaleString('fr-FR')} /></Grid>
          <Grid item xs={6}><DetailField label="Modifié" value={new Date(item.last_modified).toLocaleString('fr-FR')} /></Grid>
        </Grid>
        {item.mitre_techniques.length > 0 && (
          <>
            <Divider />
            <Title level={5}>MITRE ATT&CK</Title>
            <Space wrap>{item.mitre_techniques.map((t: string) => <Tag key={t} color="blue">{t}</Tag>)}</Space>
          </>
        )}
        {item.references.length > 0 && (
          <>
            <Divider />
            <Title level={5}>Références</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              {item.references.map((r: string) => <a key={r} href={r} target="_blank" rel="noopener">{r}</a>)}
            </Space>
          </>
        )}
      </>
    )}
    {type === 'actors' && (
      <>
        <Title level={4}>{item.name}</Title>
        <Paragraph>{item.description}</Paragraph>
        <Divider />
        <Grid container spacing={16}>
          <Grid item xs={6}><DetailField label="Pays" value={item.country} /></Grid>
          <Grid item xs={6}><DetailField label="Motivation" value={item.motivation} /></Grid>
          <Grid item xs={6}><DetailField label="Sophistication" value={item.sophistication} /></Grid>
          <Grid item xs={6}><DetailField label="First Seen" value={new Date(item.first_seen).toLocaleString('fr-FR')} /></Grid>
        </Grid>
        {item.aliases.length > 0 && (
          <>
            <Divider />
            <Title level={5}>Aliases</Title>
            <Space wrap>{item.aliases.map((a: string) => <Tag key={a}>{a}</Tag>)}</Space>
          </>
        )}
      </>
    )}
    {type === 'iocs' && (
      <>
        <div className="detail-header">
          <Tag color="blue" size="large">{item.type.toUpperCase()}</Tag>
          <Tag color={item.confidence > 80 ? 'green' : item.confidence > 50 ? 'gold' : 'red'} size="large">
            Confiance: {item.confidence}%
          </Tag>
        </div>
        <Title level={4}><Code>{item.value}</Code></Title>
        <Paragraph>{item.description}</Paragraph>
        <Divider />
        <Grid container spacing={16}>
          <Grid item xs={6}><DetailField label="Source" value={item.source} /></Grid>
          <Grid item xs={6}><DetailField label="First Seen" value={new Date(item.first_seen).toLocaleString('fr-FR')} /></Grid>
        </Grid>
        {item.tags.length > 0 && (
          <>
            <Divider />
            <Title level={5}>Tags</Title>
            <Space wrap>{item.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}</Space>
          </>
        )}
      </>
    )}
  </div>
)

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="detail-field">
    <span className="detail-field-label">{label}</span>
    <span className="detail-field-value">{value}</span>
  </div>
)

export default ThreatIntel