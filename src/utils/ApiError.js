class ApiError extends Error {
    // Constructor to initialize the custom error class
    constructor(
        statusCode, // The status code indicating the success or failure of the operation
        message = "Something went wrong", // Default error message
        errors = [], // Array to hold specific error details
        stack = "" // Optional stack trace for debugging
    ){
        super(message) // Call the parent Error class constructor with the message
        this.statusCode = statusCode // Assign the statusCode to the instance
        this.data = false // Default data property to indicate no data
        this.message = message // Assign the error message to the instance
        this.errors = errors // Assign the errors array to the instance
        this.success = false // Default success property to indicate failure

        if(stack){
            this.stack = stack; // If a stack trace is provided, assign it to the instance
        }
        else{
            Error.captureStackTrace(this, this.constructor); // Capture the stack trace for debugging
        }
    }
}

// Export the APiError class for use in other modules
export { ApiError }