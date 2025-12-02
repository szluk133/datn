import { auth } from "@/auth";
import TopicList from "@/components/admin/topic/topic.list";
import { sendRequest } from "@/utils/api";
import { ITopic } from "@/types/next-auth";

interface IWebsite {
    _id: string;
    name: string;
    displayName: string;
}

const TopicManagePage = async ({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
    const params = await searchParams;
    const session = await auth();
    const website = params.website ? String(params.website) : "";

    // 1. Fetch danh sách Website
    const resWebsites = await sendRequest<IWebsite[]>({
        url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/article/websites`,
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const websites = resWebsites?.data ?? [];

    // 2. Fetch Topics nếu có website trên URL
    let topics: ITopic[] = [];
    if (website) {
        const resTopics = await sendRequest<ITopic[]>({
            url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/topics/by-website?website=${website}`,
            method: "GET",
            headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        topics = resTopics?.data ?? [];
    }

    return (
        <div>
            <TopicList 
                websites={websites} 
                initialTopics={topics}
            />
        </div>
    );
};

export default TopicManagePage;