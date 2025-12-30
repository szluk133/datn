import { auth } from "@/auth";
import ProfileMain from "@/components/client/profile/profile.main";

const ProfilePage = async () => {
    const session = await auth();

    return (
        <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
            <ProfileMain />
        </div>
    );
};

export default ProfilePage;