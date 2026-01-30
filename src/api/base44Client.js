// Shim for removing base44 dependency
export const base44 = {
    auth: {
        me: async () => ({}),
        logout: () => { },
        redirectToLogin: () => { }
    },
    func: async (name, args) => {
        console.warn(`Called legacy function ${name}`, args);
        return { success: false, message: "Legacy function not supported" };
    }
};
