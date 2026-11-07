import React from 'react'
import { Spin } from 'antd'

export const PageLoading: React.FC = () => (
  <div className="page-loading">
    <Spin size="large" tip="Chargement..." />
  </div>
)

export const CardLoading: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="card-loading">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="loading-row">
        <div className="loading-skeleton loading-title" />
        <div className="loading-skeleton loading-text" />
        <div className="loading-skeleton loading-text short" />
      </div>
    ))}
  </div>
)

export const TableLoading: React.FC<{ columns?: number; rows?: number }> = ({ columns = 4, rows = 5 }) => (
  <div className="table-loading">
    <div className="loading-header">
      {[...Array(columns)].map((_, i) => (
        <div key={i} className="loading-skeleton loading-th" />
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="loading-row">
        {[...Array(columns)].map((_, j) => (
          <div key={j} className="loading-skeleton loading-td" />
        ))}
      </div>
    ))}
  </div>
)