interface TopBarProps {
  title: string
}

const TopBar = ({ title }: TopBarProps) => (
  <div className="px-4 py-3 sm:px-6">
    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
  </div>
)

export default TopBar
