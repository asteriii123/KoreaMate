import { EmptyState } from '../components/common'
export default function NotFoundPage() { return <div className="shell page"><EmptyState title="这条路暂时没有目的地" description="可能是地址输入有误，也可能这个页面已经搬家了。" action="返回首页" to="/"/></div> }
