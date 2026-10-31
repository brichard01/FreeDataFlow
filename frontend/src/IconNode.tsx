import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Icon } from '@iconify/react'

export type IconNode = Node<{ label: string; icon: string; hasIn: boolean; hasOut: boolean; order?: number }, 'icon'>

// Icon on top, name below; edges enter on the left and leave on the right (handles only where edges exist).
// `order` shows the script's position in the pipeline being built, as a badge on the icon.
export function IconNodeView({ data }: NodeProps<IconNode>) {
  return (
    <div className="node">
      {data.hasIn && <Handle type="target" position={Position.Left} className="node-handle" />}
      <div className="node-icon">
        <Icon icon={data.icon} width={40} height={40} />
        {data.order !== undefined && <span className="node-badge">{data.order}</span>}
      </div>
      <div className="node-label">{data.label}</div>
      {data.hasOut && <Handle type="source" position={Position.Right} className="node-handle" />}
    </div>
  )
}
