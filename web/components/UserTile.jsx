import { shortAddress } from "../lib/brand";
import style from "../styles/UserTile.module.css";

/**
 * One row of the board. `member` is normally a wallet address; a run submitted
 * before a wallet existed falls back to whatever label came with it, so render
 * anything that is not 0x-shaped verbatim rather than slicing it into nonsense.
 */
const UserTile = ({ rank, member, score, isMe = false, isBot = false }) => {
  const label = /^0x[0-9a-fA-F]{6,}$/.test(String(member || ""))
    ? shortAddress(member)
    : String(member || "unknown");

  return (
    <div
      className={`${style.container} ${isMe ? style.me : ""} ${isBot ? style.bot : ""}`}
      data-testid="board-row"
    >
      <div className={`${style.Badge} ${style[`rank${rank}`] || ""}`}>
        {rank}
      </div>
      <div className={style.Address} title={member}>
        {label}
        {isMe && <span className={style.youTag}>you</span>}
        {isBot && <span className={style.botTag}>bot</span>}
      </div>
      <span className={style.Score}>{score} pts</span>
    </div>
  );
};

export default UserTile;
