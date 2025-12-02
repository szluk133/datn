'use client'
import { Layout } from 'antd';

const AdminFooter = () => {
    const { Footer } = Layout;

    return (
        <>
            <Footer style={{ textAlign: 'center' }}>
                Lê Văn Cương ©{new Date().getFullYear()}
            </Footer>
        </>
    )
}

export default AdminFooter;