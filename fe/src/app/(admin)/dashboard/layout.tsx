import { auth } from '@/auth';
import AdminContent from '@/components/layout/admin.content';
import AdminFooter from '@/components/layout/admin.footer';
import AdminHeader from '@/components/layout/admin.header';
import AdminSideBar from '@/components/layout/admin.sidebar';
import { AdminContextProvider } from '@/library/admin.context';
import { redirect } from 'next/navigation'; // Import redirect

const AdminLayout = async ({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) => {

    const session = await auth();

    // If there is no session, redirect the user to the login page.
    // This protects the entire /dashboard route.
    if (!session) {
        redirect('/auth/login'); // Assuming your login page is at '/login'
    }

    return (
        <AdminContextProvider>
            <div style={{ display: "flex" }}>
                <div className='left-side' style={{ minWidth: 80 }}>
                    <AdminSideBar />
                </div>
                <div className='right-side' style={{ flex: 1 }}>
                    <AdminHeader session={session} />
                    <AdminContent>
                        {children}
                    </AdminContent>
                    <AdminFooter />
                </div>
            </div>
        </AdminContextProvider>
    )
}

export default AdminLayout;
