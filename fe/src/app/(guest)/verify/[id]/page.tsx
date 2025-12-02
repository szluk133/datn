import Verify from "@/components/auth/verify";

const VerifyPage = async ({ params }: { params: { id: string } }) => {
    const { id } = await params;

    return (
        <>
            <Verify id={id} />
        </>
    );
};

export default VerifyPage;