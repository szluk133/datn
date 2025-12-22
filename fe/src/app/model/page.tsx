import { auth } from "@/auth";
import React from "react";
import DashboardClient from "@/components/client/model/dashboard-client";

const ModelDashboardPage = async () => {
    const session = await auth();

    return (
        <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <DashboardClient />
            </div>
        </div>
    );
};

export default ModelDashboardPage;