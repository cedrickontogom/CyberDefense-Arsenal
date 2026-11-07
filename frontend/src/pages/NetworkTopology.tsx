import React, { useEffect, useState, useRef } from 'react'
import {
  Card, Button, Select, Space, Tag, Badge, Tooltip,
  Modal, Form, Input, Select as FormSelect, Divider,
  Table, Popover, Dropdown, Menu, Switch, Tabs, Spin
} from 'antd'
import {
  SearchOutlined, SyncOutlined, ScanOutlined, ExpandOutlined,
  DeleteOutlined, EditOutlined, EyeOutlined, DownloadOutlined,
  SettingOutlined, FilterOutlined, GlobalOutlined, LaptopOutlined,
  ServerOutlined, MobileOutlined, SafetyOutlined, WarningOutlined
} from '@ant-design/icons'
import { ReactFlow, Background, Controls, MiniMap, NodeTypes, EdgeTypes, addEdge, Connection, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { api } from '../services/api'
import { useWebSocket } from '../store/wsStore'
import './NetworkTopology.scss'

interface NetworkDevice {
  id: string
  ip: string
  mac: string
  vendor: string
  hostnames: string[]
  ports: Array<{ port: number; protocol: string; state: string; service?: string }>
  os: string
  device_type: string
  first_seen: string
  last_seen: string
  metadata: Record<string, string>
  position?: { x: number; y: number }
}

interface NetworkScan {
  id: string
  interface: string
  cidr: string
  ports: number[]
  status: string
  progress: number
  devices: NetworkDevice[]
  started_at: string
  completed_at?: string
  error?: string
}

interface CustomNodeData {
  label: string
  device: NetworkDevice
  type: string
}

const deviceTypeIcons: Record<string, React.ReactNode> = {
  server: <ServerOutlined />,
  workstation: <LaptopOutlined />,
  mobile: <MobileOutlined />,
  network: <GlobalOutlined />,
  iot: <SafetyOutlined />,
  camera: <WarningOutlined />,
  printer: <SettingOutlined />,
  nas: <DatabaseOutlined />,
  vm: <ServerOutlined />,
  apple: <LaptopOutlined />,
  windows: <LaptopOutlined />,
  linux: <ServerOutlined />,
  macos: <LaptopOutlined />,
  web: <GlobalOutlined />,
  'web-server': <GlobalOutlined />,
  unknown: <LaptopOutlined />,
}

const deviceTypeColors: Record<string, string> = {
  server: '#1890ff',
  workstation: '#52c41a',
  mobile: '#722ed1',
  network: '#fa8c16',
  iot: '#13c2c2',
  camera: '#ff4d4f',
  printer: '#eb2f96',
  nas: '#fadb14',
  vm: '#2f54eb',
  apple: '#000000',
  windows: '#0078d4',
  linux: '#fcc624',
  macos: '#999999',
  web: '#1890ff',
  'web-server': '#1890ff',
  unknown: '#bfbfbf',
}

const NetworkTopology: React.FC = () => {
  const [scans, setScans] = useState<NetworkScan[]>([])
  const [currentScan, setCurrentScan] = useState<NetworkScan | null>(null)
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const [filteredDevices, setFilteredDevices] = useState<NetworkDevice[]>([])
  const [nodes, setNodes] = useState<Node<CustomNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null)
  const [scanModalVisible, setScanModalVisible] = useState(false)
  const [scanForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [interfaces, setInterfaces] = useState<Array<{ name: string; ips: string[] }>>([])
  const [filter, setFilter] = useState({ type: '', search: '', status: '' })
  const [viewMode, setViewMode] = useState<'topology' | 'table'>('topology')
  const reactFlowRef = useRef<ReactFlow<CustomNodeData>>(null)
  const { alertNotifications } = useWebSocket()

  // Fetch data on mount
  useEffect(() => {
    fetchScans()
    fetchInterfaces()
  }, [])

  // Fetch scans
  const fetchScans = async () => {
    try {
      const res = await api.get('/network-api/api/v1/scans')
      setScans(res.scans || [])
      if (res.scans?.length > 0 && !currentScan) {
        setCurrentScan(res.scans[0])
        setDevices(res.scans[0].devices || [])
        buildGraph(res.scans[0].devices || [])
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error)
    }
  }

  // Fetch network interfaces
  const fetchInterfaces = async () => {
    try {
      const res = await api.get('/network-api/api/v1/interfaces')
      setInterfaces(res.interfaces || [])
    } catch (error) {
      console.error('Failed to fetch interfaces:', error)
    }
  }

  // Build graph from devices
  const buildGraph = (deviceList: NetworkDevice[]) => {
    const newNodes: Node<CustomNodeData>[] = deviceList.map((device, index) => ({
      id: device.ip,
      type: 'device',
      position: device.position || {
        x: (index % 8) * 220 + 100,
        y: Math.floor(index / 8) * 180 + 100,
      },
      data: {
        label: device.hostnames[0] || device.ip,
        device,
        type: device.device_type,
      },
    }))

    // Create edges based on subnet proximity
    const newEdges: Edge[] = []
    deviceList.forEach((device, i) => {
      deviceList.slice(i + 1).forEach((otherDevice) => {
        if (isSameSubnet(device.ip, otherDevice.ip)) {
          newEdges.push({
            id: `e-${device.ip}-${otherDevice.ip}`,
            source: device.ip,
            target: otherDevice.ip,
            type: 'subnet',
            animated: true,
            style: { stroke: '#1890ff30', strokeWidth: 1 },
          })
        }
      })
    })

    setNodes(newNodes)
    setEdges(newEdges)
  }

  const isSameSubnet = (ip1: string, ip2: string) => {
    const parts1 = ip1.split('.')
    const parts2 = ip2.split('.')
    return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2]
  }

  // Handle scan selection
  const handleScanSelect = (scan: NetworkScan) => {
    setCurrentScan(scan)
    setDevices(scan.devices || [])
    setFilteredDevices(scan.devices || [])
    buildGraph(scan.devices || [])
  }

  // Start new scan
  const handleStartScan = async (values: any) => {
    setLoading(true)
    try {
      const res = await api.post('/network-api/api/v1/scans', {
        interface: values.interface,
        cidr: values.cidr,
        ports: values.ports || [22, 80, 443, 445, 139, 135, 8080, 3389, 5900, 8006],
      })
      setScanModalVisible(false)
      fetchScans()
    } catch (error) {
      console.error('Failed to start scan:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter devices
  useEffect(() => {
    let result = devices
    if (filter.type) {
      result = result.filter(d => d.device_type === filter.type)
    }
    if (filter.search) {
      const search = filter.search.toLowerCase()
      result = result.filter(d =>
        d.ip.includes(search) ||
        d.hostnames.some(h => h.toLowerCase().includes(search)) ||
        d.vendor.toLowerCase().includes(search) ||
        d.mac.toLowerCase().includes(search)
      )
    }
    if (filter.status) {
      result = result.filter(d => d.ports.some(p => p.state === filter.status))
    }
    setFilteredDevices(result)
  }, [devices, filter])

  // Device node component
  const DeviceNode: React.FC<{ data: CustomNodeData }> = ({ data }) => {
    const { device, label, type } = data
    const color = deviceTypeColors[type] || deviceTypeColors.unknown
    const icon = deviceTypeIcons[type] || deviceTypeIcons.unknown
    const isSelected = selectedDevice?.ip === device.ip

    return (
      <div
        className={`device-node ${isSelected ? 'selected' : ''}`}
        style={{ borderColor: color }}
        onClick={() => setSelectedDevice(device)}
      >
        <div className="node-header" style={{ backgroundColor: color }}>
          <span className="node-icon">{icon}</span>
          <Badge count={device.ports.filter(p => p.state === 'open').length} color="red" className="port-badge" />
        </div>
        <div className="node-body">
          <div className="node-label" title={label}>{label}</div>
          <div className="node-ip">{device.ip}</div>
          <div className="node-meta">
            <Tag color={deviceTypeColors[type] || 'default'}>{type}</Tag>
            {device.vendor && <span className="node-vendor">{device.vendor}</span>}
          </div>
        </div>
        <div className="node-ports">
          {device.ports.filter(p => p.state === 'open').slice(0, 4).map(p => (
            <span key={p.port} className="port-tag" title={`${p.service || 'unknown'} (${p.port})`}>
              {p.port}
            </span>
          ))}
          {device.ports.filter(p => p.state === 'open').length > 4 && (
            <span className="port-tag more">+{device.ports.filter(p => p.state === 'open').length - 4}</span>
          )}
        </div>
      </div>
    )
  }

  // Node and edge types
  const nodeTypes: NodeTypes = {
    device: DeviceNode,
  }

  const edgeTypes: EdgeTypes = {
    subnet: ({ sourceX, sourceY, targetX, targetY }) => (
      <path
        d={`M ${sourceX} ${sourceY} Q ${(sourceX + targetX) / 2} ${(sourceY + targetY) / 2 - 50} ${targetX} ${targetY}`}
        stroke="#1890ff30"
        strokeWidth={1}
        fill="none"
        strokeDasharray="5,5"
      />
    ),
  }

  // Context menu for nodes
  const getContextMenu = (device: NetworkDevice) => [
    { key: 'view', label: 'Voir détails', icon: <EyeOutlined /> },
    { key: 'scan', label: 'Scanner ports', icon: <ScanOutlined /> },
    { key: 'resolve', label: 'Résoudre hostname', icon: <GlobalOutlined /> },
    { type: 'divider' as const },
    { key: 'fingerprint', label: 'Empreinte digitale', icon: <SafetyOutlined /> },
  ]

  return (
    <div className="network-topology">
      {/* Toolbar */}
      <Card className="toolbar-card">
        <Space wrap style={{ width: '100%' }}>
          <Space>
            <Button icon={<SyncOutlined />} onClick={fetchScans} loading={loading}>
              Actualiser
            </Button>
            <Button icon={<ScanOutlined />} type="primary" onClick={() => setScanModalVisible(true)}>
              Nouveau Scan
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Exporter
            </Button>
          </Space>

          <Space>
            <Select
              placeholder="Filtrer par type"
              value={filter.type}
              onChange={v => setFilter({ ...filter, type: v })}
              style={{ width: 180 }}
              options={[
                { value: '', label: 'Tous les types' },
                ...Array.from(new Set(devices.map(d => d.device_type))).map(t => ({ value: t, label: t })),
              ]}
            />
            <Select
              placeholder="Filtrer par statut port"
              value={filter.status}
              onChange={v => setFilter({ ...filter, status: v })}
              style={{ width: 180 }}
              options={[
                { value: '', label: 'Tous' },
                { value: 'open', label: 'Ouverts' },
                { value: 'closed', label: 'Fermés' },
                { value: 'filtered', label: 'Filtrés' },
              ]}
            />
            <Input.Search
              placeholder="Rechercher (IP, hostname, MAC, vendor)..."
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
              style={{ width: 250 }}
              enterButton
            />
          </Space>

          <Space>
            <Button.Group>
              <Button
                icon={<GlobalOutlined />}
                type={viewMode === 'topology' ? 'primary' : 'default'}
                onClick={() => setViewMode('topology')}
              >
                Topologie
              </Button>
              <Button
                icon={<TableOutlined />}
                type={viewMode === 'table' ? 'primary' : 'default'}
                onClick={() => setViewMode('table')}
              >
                Tableau
              </Button>
            </Button.Group>
          </Space>
        </Space>
      </Card>

      {/* Main Content */}
      <div className="main-content">
        {viewMode === 'topology' ? (
          <Card className="topology-card">
            <div className="topology-header">
              <Space>
                <Typography.Title level={4}>
                  {currentScan ? `Scan: ${currentScan.cidr} (${devices.length} appareils)` : 'Aucun scan sélectionné'}
                </Typography.Title>
                {currentScan && (
                  <Space>
                    <Tag color={currentScan.status === 'completed' ? 'green' : currentScan.status === 'running' ? 'blue' : 'red'}>
                      {currentScan.status}
                    </Tag>
                    {currentScan.status === 'running' && (
                      <span className="scan-progress">
                        Progression: {currentScan.progress.toFixed(1)}%
                      </span>
                    )}
                  </Space>
                )}
              </Space>
              <MiniMap
                nodeColor={({ type }) => type === 'device' ? '#1890ff' : '#999'}
                maskColor="rgba(0,0,0,0.1)"
              />
            </div>
            <div className="react-flow-wrapper">
              <ReactFlow<CustomNodeData>
                ref={reactFlowRef}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={changes => setNodes(ns => ns.map(n => changes.reduce((acc, change) => change.id === n.id ? { ...n, ...change } : n, n)))}
                onEdgesChange={changes => setEdges(es => es.map(e => changes.reduce((acc, change) => change.id === e.id ? { ...e, ...change } : e, e)))}
                onConnect={params => setEdges(eds => addEdge(params, eds))}
                onNodeClick={(_event, node) => {
                  const device = nodes.find(n => n.id === node.id)?.data?.device
                  if (device) setSelectedDevice(device)
                }}
                fitView={true}
                attributionPosition="bottom-left"
              >
                <Background color="#f0f0f0" gap={20} />
                <Controls />
              </ReactFlow>
            </div>
          </Card>
        ) : (
          <Card className="table-card">
            <Table
              dataSource={filteredDevices}
              rowKey="ip"
              pagination={{ pageSize: 20 }}
              columns={[
                {
                  title: 'Appareil',
                  key: 'device',
                  render: (_, device) => (
                    <Space>
                      {deviceTypeIcons[device.device_type] || deviceTypeIcons.unknown}
                      <span>
                        <strong>{device.hostnames[0] || device.ip}</strong>
                        <br />
                        <span style={{ color: '#999', fontSize: 12 }}>{device.ip}</span>
                      </span>
                    </Space>
                  ),
                },
                {
                  title: 'Type',
                  dataIndex: 'device_type',
                  key: 'type',
                  render: (type: string) => (
                    <Tag color={deviceTypeColors[type] || 'default'}>{type}</Tag>
                  ),
                  filters: devices.map(d => d.device_type).filter((v, i, a) => a.indexOf(v) === i).map(v => ({ text: v, value: v })),
                  onFilter: (value, record) => record.device_type === value,
                },
                {
                  title: 'MAC / Vendor',
                  key: 'mac',
                  render: (_, device) => (
                    <div>
                      <code>{device.mac || 'N/A'}</code>
                      {device.vendor && <br /><span style={{ color: '#999', fontSize: 12 }}>{device.vendor}</span>}
                    </div>
                  ),
                },
                {
                  title: 'Ports Ouverts',
                  key: 'ports',
                  render: (_, device) => (
                    <Space wrap>
                      {device.ports.filter(p => p.state === 'open').slice(0, 6).map(p => (
                        <Tag key={p.port} color="blue">{p.port} ({p.service || '?'})</Tag>
                      ))}
                      {device.ports.filter(p => p.state === 'open').length > 6 && (
                        <Tag color="gray">+{device.ports.filter(p => p.state === 'open').length - 6} autres</Tag>
                      )}
                    </Space>
                  ),
                },
                {
                  title: 'OS',
                  dataIndex: 'os',
                  key: 'os',
                },
                {
                  title: 'Dernière vue',
                  dataIndex: 'last_seen',
                  key: 'last_seen',
                  render: (date: string) => new Date(date).toLocaleString('fr-FR'),
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_, device) => (
                    <Dropdown
                      menu={{
                        items: getContextMenu(device),
                        onClick: ({ key }) => handleDeviceAction(key, device),
                      }}
                      placement="bottomRight"
                    >
                      <Button type="link" size="small">Actions <DownOutlined /></Button>
                    </Dropdown>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {/* Device Detail Panel */}
        {selectedDevice && (
          <div className="detail-panel">
            <DeviceDetailPanel
              device={selectedDevice}
              onClose={() => setSelectedDevice(null)}
            />
          </div>
        )}
      </div>

      {/* Scan Modal */}
      <Modal
        title="Nouveau Scan Réseau"
        open={scanModalVisible}
        onOk={() => scanForm.validateFields().then(handleStartScan).catch(() => {})}
        onCancel={() => setScanModalVisible(false)}
        confirmLoading={loading}
        width={600}
        form={scanForm}
      >
        <Form layout="vertical">
          <Form.Item name="interface" label="Interface" rules={[{ required: true }]}>
            <FormSelect
              options={interfaces.map(i => ({ value: i.name, label: `${i.name} (${i.ips.join(', ')})` }))}
              placeholder="Sélectionner l'interface"
              showSearch
            />
          </Form.Item>
          <Form.Item name="cidr" label="CIDR" rules={[{ required: true }]}>
            <Input placeholder="ex: 192.168.1.0/24" />
          </Form.Item>
          <Form.Item name="ports" label="Ports à scanner">
            <Input placeholder="22,80,443,445,139,135,8080,3389,5900,8006" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

const handleExport = async () => {
  // Export logic
}

const handleDeviceAction = (action: string, device: NetworkDevice) => {
  console.log(action, device)
}

// Device Detail Panel
const DeviceDetailPanel: React.FC<{ device: NetworkDevice; onClose: () => void }> = ({ device, onClose }) => {
  const openPorts = device.ports.filter(p => p.state === 'open')
  const closedPorts = device.ports.filter(p => p.state === 'closed')

  return (
    <div className="detail-panel-content">
      <div className="detail-header">
        <Space>
          <div className="device-avatar" style={{ backgroundColor: deviceTypeColors[device.device_type] || '#999' }}>
            {deviceTypeIcons[device.device_type] || deviceTypeIcons.unknown}
          </div>
          <div>
            <Typography.Title level={4}>{device.hostnames[0] || device.ip}</Typography.Title>
            <Typography.Text type="secondary">{device.ip} • {device.device_type}</Typography.Text>
          </div>
          <Button type="link" size="small" onClick={onClose}>
            <CloseOutlined />
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="1" className="detail-tabs">
        <Tabs.TabPane tab="Informations" key="1">
          <div className="detail-grid">
            <DetailRow label="Adresse IP" value={device.ip} copyable />
            <DetailRow label="Adresse MAC" value={device.mac || 'N/A'} copyable />
            <DetailRow label="Vendor" value={device.vendor || 'N/A'} />
            <DetailRow label="Hostnames" value={device.hostnames.join(', ') || 'N/A'} />
            <DetailRow label="Type d'appareil" value={<Tag color={deviceTypeColors[device.device_type] || 'default'}>{device.device_type}</Tag>} />
            <DetailRow label="OS détecté" value={device.os || 'N/A'} />
            <DetailRow label="Première vue" value={new Date(device.first_seen).toLocaleString('fr-FR')} />
            <DetailRow label="Dernière vue" value={new Date(device.last_seen).toLocaleString('fr-FR')} />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={`Ports (${openPorts.length})`} key="2">
          <Table
            dataSource={openPorts}
            pagination={false}
            columns={[
              { title: 'Port', dataIndex: 'port', key: 'port', width: 80 },
              { title: 'Protocole', dataIndex: 'protocol', key: 'protocol', width: 100 },
              { title: 'État', dataIndex: 'state', key: 'state', width: 100, render: (s: string) => <Tag color={s === 'open' ? 'green' : 'red'}>{s}</Tag> },
              { title: 'Service', dataIndex: 'service', key: 'service', render: (s: string) => s || 'Inconnu' },
              { title: 'Bannière', dataIndex: 'banner', key: 'banner', ellipsis: true },
            ]}
          />
          {closedPorts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text type="secondary">{closedPorts.length} ports fermés</Typography.Text>
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane tab="Métadonnées" key="3">
          <Table
            dataSource={Object.entries(device.metadata).map(([key, value]) => ({ key, value }))}
            pagination={false}
            columns={[
              { title: 'Clé', dataIndex: 'key', key: 'key', width: '30%' },
              { title: 'Valeur', dataIndex: 'value', key: 'value', ellipsis: true },
            ]}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  )
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode; copyable?: boolean }> = ({ label, value, copyable }) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">
      {value}
      {copyable && <Tooltip title="Copier"><CopyOutlined onClick={() => navigator.clipboard.writeText(String(value))} /></Tooltip>}
    </span>
  </div>
)

export default NetworkTopology