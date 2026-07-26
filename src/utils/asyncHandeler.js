const asyncHandeler = (requestHandeler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandeler(req, res, next)).catch((err) => { next(err) })
    }
}


export { asyncHandeler }