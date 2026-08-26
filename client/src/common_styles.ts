import { css } from 'lit';


export const modalBackdropStyle = css`
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100svh;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}
`;

export const modalContainerStyle = css`
	.modal-container {
		background: white;
		border: 4px solid black;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
		min-width: 200px;
		width: 500px;
	}
`;

export const inputStyle = css`
	.input-field {
		border: 2px solid black;
		padding: 8px;
		font-size: 16px;
		outline: none;
	}
	.input-field.error {
		border-color: red;
	}
`;
