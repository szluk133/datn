import { auth } from "@/auth";
import MyArticleMain from "@/components/client/my-article/my.article.main";

const MyArticlePage = async () => {
    const session = await auth();

    return (
        <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', padding: '24px' }}>
            <MyArticleMain />
        </div>
    );
};

export default MyArticlePage;